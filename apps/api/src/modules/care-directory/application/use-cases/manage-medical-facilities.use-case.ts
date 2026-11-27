import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CARE_DIRECTORY_QUERY_REPOSITORY,
  FACILITY_ADMIN_AUTHORITY,
  MAP_PROVIDER,
  MEDICAL_FACILITY_REPOSITORY,
  type CareDirectoryQueryRepository,
  type FacilityAdminAuthority,
  type MapProvider,
  type MedicalFacilityRepository,
} from '../ports/care-directory.ports';
import type {
  FacilityContact,
  FacilityType,
  FacilityDraftDetails,
} from '../../domain/care-directory.types';
import { facilityNeedsRecheck } from '../../domain/policies/facility-policy';
import {
  FacilityDuplicateReviewCandidateMismatchError,
  FacilityDuplicateReviewRequiredError,
  FacilityPlaceIdConflictError,
  type FacilityDuplicateReviewInput,
} from '../../domain/policies/facility-duplicate-policy';

export interface FacilityDetailsInput {
  name?: string;
  facilityType?: FacilityType;
  address?: {
    street?: string;
    ward?: string;
    district?: string;
    province?: string;
  };
  location?: { longitude: number; latitude: number };
  specialtyCodes?: string[];
  services?: string[];
  contact?: FacilityContact;
  officialSourceUrl?: string;
}

@Injectable()
export class ManageMedicalFacilities {
  constructor(
    @Inject(MEDICAL_FACILITY_REPOSITORY)
    private readonly facilities: MedicalFacilityRepository,
    @Inject(CARE_DIRECTORY_QUERY_REPOSITORY)
    private readonly queries: CareDirectoryQueryRepository,
    @Inject(FACILITY_ADMIN_AUTHORITY)
    private readonly admins: FacilityAdminAuthority,
    @Inject(MAP_PROVIDER) private readonly maps: MapProvider,
    private readonly config: ConfigService,
  ) {}

  async list(
    actorId: string,
    input: {
      status?: string;
      needsRecheck?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    await this.assertSuperAdmin(actorId);
    const now = new Date();
    const staleAfterDays = this.config.get<number>(
      'FACILITY_FRESHNESS_DAYS',
      180,
    );
    const result = await this.facilities.listAdminFacilities({
      status: input.status,
      needsRecheck: input.needsRecheck,
      staleBefore: new Date(now.getTime() - staleAfterDays * 86_400_000),
      page: input.page ?? 1,
      limit: input.limit ?? 20,
    });
    return {
      data: {
        ...result,
        items: result.items.map((facility) => ({
          ...facility,
          needsRecheck:
            facility.status === 'verified' &&
            (!facility.lastCheckedAt ||
              facilityNeedsRecheck(
                new Date(facility.lastCheckedAt),
                now,
                staleAfterDays,
              )),
        })),
      },
    };
  }

  async get(actorId: string, id: string) {
    await this.assertSuperAdmin(actorId);
    const result = await this.facilities.getAdminFacility(id);
    if (!result) throw new NotFoundException('FACILITY_NOT_FOUND');
    result.needsRecheck =
      result.status === 'verified' &&
      (!result.lastCheckedAt ||
        facilityNeedsRecheck(
          new Date(result.lastCheckedAt),
          new Date(),
          this.config.get<number>('FACILITY_FRESHNESS_DAYS', 180),
        ));
    return { data: result };
  }

  async createDraft(
    actorId: string,
    key: string,
    details: FacilityDetailsInput,
    duplicateReview?: FacilityDuplicateReviewInput,
  ) {
    await this.assertSuperAdmin(actorId);
    this.assertEnabled();
    this.assertKey(key);
    const normalized = this.toDomainDetails(details);
    await this.assertSpecialties(normalized.specialtyCodes ?? []);
    try {
      return {
        data: await this.facilities.createFacilityDraft({
          details: normalized,
          duplicateReview,
          actorId,
          key,
        }),
      };
    } catch (error) {
      this.mapError(error);
    }
  }

  async createDraftFromMapCandidate(
    actorId: string,
    key: string,
    placeId: string,
    duplicateReview?: FacilityDuplicateReviewInput,
  ) {
    await this.assertSuperAdmin(actorId);
    this.assertEnabled();
    this.assertKey(key);
    if (!placeId.trim() || placeId.length > 256)
      throw new BadRequestException('GOOGLE_PLACE_ID_INVALID');
    const command = {
      placeId: placeId.trim(),
      actorId,
      key,
      duplicateReview,
    };
    const replay =
      await this.facilities.findCreateFacilityDraftFromPlaceReplay(command);
    if (replay) return { data: replay };
    const existingOwner = await this.facilities.findFacilityByGooglePlaceId(
      command.placeId,
    );
    if (existingOwner)
      throw new ConflictException({
        code: 'FACILITY_GOOGLE_PLACE_ALREADY_LINKED',
        message: 'Google Place ID đang được gắn với một Facility khác.',
        details: { facility: existingOwner },
      });
    let providerPreview: Awaited<ReturnType<MapProvider['findPlace']>>;
    try {
      providerPreview = await this.maps.findPlace(command.placeId, actorId);
      if (providerPreview.placeId !== command.placeId)
        throw new ServiceUnavailableException('MAP_PROVIDER_UNAVAILABLE');
    } catch (error) {
      const completed =
        await this.facilities.findCreateFacilityDraftFromPlaceReplay(command);
      if (completed) return { data: completed };
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('MAP_PROVIDER_UNAVAILABLE');
    }
    try {
      const draft = await this.facilities.createFacilityDraftFromPlace({
        ...command,
        providerPreview,
      });
      return {
        data: {
          ...draft,
          providerPreview: {
            ...providerPreview,
            source: 'google_maps' as const,
            verifiedInternally: false as const,
          },
        },
      };
    } catch (error) {
      this.mapError(error);
    }
  }

  async updateDraft(
    actorId: string,
    key: string,
    id: string,
    input: {
      revisionId?: string;
      expectedRevision: number;
      details: FacilityDetailsInput;
    },
  ) {
    await this.assertSuperAdmin(actorId);
    this.assertEnabled();
    this.assertKey(key);
    if (
      !Number.isInteger(input.expectedRevision) ||
      input.expectedRevision < 1
    ) {
      throw new BadRequestException('EXPECTED_REVISION_REQUIRED');
    }
    const details = this.toDomainDetails(input.details);
    await this.assertSpecialties(details.specialtyCodes ?? []);
    try {
      return {
        data: await this.facilities.updateFacilityDraft({
          id,
          revisionId: input.revisionId,
          details,
          expectedRevision: input.expectedRevision,
          actorId,
          key,
        }),
      };
    } catch (error) {
      this.mapError(error);
    }
  }

  async createRevision(actorId: string, key: string, id: string) {
    await this.assertSuperAdmin(actorId);
    this.assertEnabled();
    this.assertKey(key);
    try {
      return {
        data: await this.facilities.createFacilityRevision({
          id,
          actorId,
          key,
        }),
      };
    } catch (error) {
      this.mapError(error);
    }
  }

  async verify(
    actorId: string,
    key: string,
    id: string,
    input: {
      revisionId: string;
      expectedRevision: number;
      providerDataReviewedAgainstOfficialSource?: boolean;
      duplicateReview?: FacilityDuplicateReviewInput;
    },
  ) {
    await this.assertSuperAdmin(actorId);
    this.assertEnabled();
    this.assertKey(key);
    if (
      !Number.isInteger(input.expectedRevision) ||
      input.expectedRevision < 1
    ) {
      throw new BadRequestException('EXPECTED_REVISION_REQUIRED');
    }
    try {
      return {
        data: await this.facilities.verifyFacility({
          id,
          revisionId: input.revisionId,
          expectedRevision: input.expectedRevision,
          providerDataReviewedAgainstOfficialSource:
            input.providerDataReviewedAgainstOfficialSource,
          duplicateReview: input.duplicateReview,
          actorId,
          key,
        }),
      };
    } catch (error) {
      this.mapError(error);
    }
  }

  async retire(
    actorId: string,
    key: string,
    id: string,
    input: { reason: string; expectedRevision: number },
  ) {
    await this.assertSuperAdmin(actorId);
    this.assertEnabled();
    this.assertKey(key);
    if (
      !input.reason.trim() ||
      input.reason.length > 300 ||
      !Number.isInteger(input.expectedRevision) ||
      input.expectedRevision < 1
    ) {
      throw new BadRequestException('FACILITY_RETIRE_INPUT_INVALID');
    }
    try {
      await this.facilities.retireFacility({
        id,
        reason: input.reason.trim(),
        expectedRevision: input.expectedRevision,
        actorId,
        key,
      });
      return { data: { retired: true } };
    } catch (error) {
      this.mapError(error);
    }
  }

  private toDomainDetails(input: FacilityDetailsInput): FacilityDraftDetails {
    if (!input) throw new BadRequestException('FACILITY_DETAILS_REQUIRED');
    const codes = input.specialtyCodes?.map((code) =>
      code.trim().toLowerCase(),
    );
    if (
      codes &&
      (codes.some((code) => !code) || new Set(codes).size !== codes.length)
    )
      throw new BadRequestException('FACILITY_SPECIALTIES_REQUIRED');
    return {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.facilityType !== undefined
        ? { facilityType: input.facilityType }
        : {}),
      ...(input.address?.province
        ? {
            address: {
              ...input.address,
              province: input.address.province,
              provinceCode: 'HCMC',
              country: 'VN',
            },
          }
        : {}),
      ...(input.location
        ? {
            location: {
              type: 'Point',
              coordinates: [input.location.longitude, input.location.latitude],
            },
          }
        : {}),
      ...(codes ? { specialtyCodes: codes } : {}),
      ...(input.services ? { services: input.services } : {}),
      ...(input.contact ? { contact: input.contact } : {}),
      ...(input.officialSourceUrl
        ? { officialSourceUrl: input.officialSourceUrl }
        : {}),
    };
  }

  private async assertSpecialties(codes: string[]) {
    const values = await Promise.all(
      codes.map((code) => this.queries.getActiveSpecialty(code)),
    );
    if (values.some((value) => !value))
      throw new BadRequestException('FACILITY_SPECIALTY_NOT_ACTIVE');
  }

  private async assertSuperAdmin(actorId: string) {
    if (!(await this.admins.isSuperAdmin(actorId)))
      throw new ForbiddenException('SUPER_ADMIN_REQUIRED');
  }

  private assertEnabled() {
    if (!this.config.get<boolean>('FACILITY_DIRECTORY_ENABLED', false))
      throw new ServiceUnavailableException('FACILITY_DIRECTORY_DISABLED');
  }

  private assertKey(key: string) {
    if (!key || key.length < 16 || key.length > 128)
      throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');
  }

  private mapError(error: unknown): never {
    if (error instanceof FacilityDuplicateReviewCandidateMismatchError)
      throw new ConflictException({
        code: error.code,
        message:
          'Danh sách cơ sở đã rà soát không còn khớp với các ứng viên hiện tại. Hãy tải lại ứng viên rồi xác nhận lại.',
      });
    if (error instanceof FacilityDuplicateReviewRequiredError)
      throw new ConflictException({
        code: error.code,
        message: error.truncated
          ? 'Có quá nhiều ứng viên cần rà soát. Hãy bổ sung tên/địa chỉ cụ thể hơn rồi thử lại.'
          : 'Cần rà soát các Facility có khả năng trùng trước khi tiếp tục.',
        details: { candidates: error.candidates, truncated: error.truncated },
      });
    if (error instanceof FacilityPlaceIdConflictError)
      throw new ConflictException({
        code: error.code,
        message: 'Google Place ID đã được gắn với Facility khác.',
        details: { facility: error.facility },
      });
    if (error instanceof Error) {
      if (error.message.includes('NOT_FOUND'))
        throw new NotFoundException(error.message);
      if (
        error.message.includes('DUPLICATE') ||
        error.message.includes('CONFLICT') ||
        error.message.includes('REVISION')
      )
        throw new ConflictException(error.message);
      if (error.message.startsWith('FACILITY_'))
        throw new BadRequestException(error.message);
    }
    throw error;
  }

  async updateFacilityMetadata(
    actorId: string,
    key: string,
    id: string,
    input: { placeId: string; expectedRevision: number },
  ) {
    await this.assertSuperAdmin(actorId);
    this.assertEnabled();
    this.assertKey(key);
    if (
      !input.placeId.trim() ||
      input.placeId.length > 256 ||
      !Number.isInteger(input.expectedRevision) ||
      input.expectedRevision < 1
    )
      throw new BadRequestException('FACILITY_PLACE_LINK_INPUT_INVALID');
    const command = {
      id,
      placeId: input.placeId.trim(),
      expectedRevision: input.expectedRevision,
      actorId,
      key,
    };
    const replay =
      await this.facilities.findUpdateFacilityMetadataReplay(command);
    if (replay) return { data: replay };
    const facility = await this.facilities.getAdminFacility(id);
    if (!facility) throw new NotFoundException('FACILITY_NOT_FOUND');
    if (facility.status === 'retired')
      throw new ConflictException('FACILITY_RETIRED_CANNOT_LINK_PLACE');
    if (facility.googlePlaceId && facility.googlePlaceId !== command.placeId)
      throw new ConflictException('FACILITY_GOOGLE_PLACE_CHANGE_NOT_SUPPORTED');
    const currentOwner = await this.facilities.findFacilityByGooglePlaceId(
      command.placeId,
    );
    if (currentOwner && currentOwner.id !== id)
      throw new ConflictException({
        code: 'FACILITY_GOOGLE_PLACE_ALREADY_LINKED',
        message: 'Google Place ID đang được gắn với một Facility khác.',
        details: { facility: currentOwner },
      });

    if (facility.googlePlaceId === command.placeId) {
      try {
        return { data: await this.facilities.updateFacilityMetadata(command) };
      } catch (error) {
        this.mapError(error);
      }
    }

    try {
      const preview = await this.maps.findPlace(command.placeId, actorId);
      if (preview.placeId !== command.placeId)
        throw new ServiceUnavailableException('MAP_PROVIDER_UNAVAILABLE');
    } catch (error) {
      const completed =
        await this.facilities.findUpdateFacilityMetadataReplay(command);
      if (completed) return { data: completed };
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('MAP_PROVIDER_UNAVAILABLE');
    }
    try {
      return { data: await this.facilities.updateFacilityMetadata(command) };
    } catch (error) {
      this.mapError(error);
    }
  }
}
