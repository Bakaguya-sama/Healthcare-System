import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
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
  type GooglePlaceTypeFilter,
  type MapPlacePreview,
  type MapProvider,
  type MedicalFacilityRepository,
} from '../ports/care-directory.ports';

export interface MapFacilitySearchInput {
  query?: string;
  specialtyCode?: string;
  area?: string;
  location?: { longitude: number; latitude: number };
  locationConsent?: boolean;
  radiusKm?: number;
  placeType?: GooglePlaceTypeFilter;
}

@Injectable()
export class SearchMapFacilityCandidates {
  constructor(
    @Inject(CARE_DIRECTORY_QUERY_REPOSITORY)
    private readonly directory: CareDirectoryQueryRepository,
    @Inject(FACILITY_ADMIN_AUTHORITY)
    private readonly admins: FacilityAdminAuthority,
    @Inject(MAP_PROVIDER) private readonly maps: MapProvider,
    @Inject(MEDICAL_FACILITY_REPOSITORY)
    private readonly facilities: MedicalFacilityRepository,
    private readonly config: ConfigService,
  ) {}

  async forPatient(patientId: string, input: MapFacilitySearchInput) {
    this.assertProviderEnabled();
    const specialtyCode = input.specialtyCode?.trim();
    if (!specialtyCode || input.query !== undefined)
      throw new BadRequestException('SPECIALTY_REQUIRED');
    this.assertAreaOrLocation(input, true);
    if (input.location && input.locationConsent !== true)
      throw new BadRequestException('EXPLICIT_LOCATION_CONSENT_REQUIRED');
    const specialty = await this.resolveSpecialty(specialtyCode);
    return this.providerSearch(
      patientId,
      { specialtyName: specialty.nameVi },
      input,
    );
  }

  async forSuperAdmin(actorId: string, input: MapFacilitySearchInput) {
    await this.assertSuperAdmin(actorId);
    this.assertProviderEnabled();

    const hasQuery = input.query !== undefined;
    const hasSpecialty = input.specialtyCode !== undefined;
    if (hasQuery === hasSpecialty)
      throw new BadRequestException('MAP_SEARCH_SELECTOR_AMBIGUOUS');

    if (hasQuery) {
      const query = input.query?.trim();
      if (!query || query.length < 2 || query.length > 180)
        throw new BadRequestException('MAP_SEARCH_QUERY_INVALID');
      this.assertAreaOrLocation(input, false);
      return this.providerSearch(actorId, { query }, input);
    }

    const specialtyCode = input.specialtyCode?.trim();
    if (!specialtyCode || specialtyCode.length > 60)
      throw new BadRequestException('SPECIALTY_REQUIRED');
    this.assertAreaOrLocation(input, true);
    const specialty = await this.resolveSpecialty(specialtyCode);
    return this.providerSearch(
      actorId,
      { specialtyName: specialty.nameVi },
      input,
    );
  }

  async previewStoredCandidate(actorId: string, facilityId: string) {
    await this.assertSuperAdmin(actorId);
    this.assertProviderEnabled();
    const facility = await this.facilities.getAdminFacility(facilityId);
    if (!facility?.googlePlaceId)
      throw new BadRequestException('GOOGLE_PLACE_REFERENCE_NOT_FOUND');
    try {
      const candidate = await this.maps.findPlace(
        facility.googlePlaceId,
        actorId,
      );
      return { data: this.toProviderPreview(candidate) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('MAP_PROVIDER_UNAVAILABLE');
    }
  }

  private async resolveSpecialty(code: string) {
    if (!code) throw new BadRequestException('SPECIALTY_REQUIRED');
    const specialty = await this.directory.getActiveSpecialty(
      code.toLowerCase(),
    );
    if (!specialty) throw new BadRequestException('SPECIALTY_NOT_FOUND');
    return specialty;
  }

  private async providerSearch(
    actorId: string,
    selector: { query?: string; specialtyName?: string },
    input: MapFacilitySearchInput,
  ) {
    const area = input.area?.trim();
    const radiusKm = input.radiusKm ?? 10;
    this.assertLocationAndRadius(input, radiusKm);
    try {
      const candidates = await this.maps.search({
        actorId,
        ...selector,
        area,
        location: input.location,
        radiusKm,
        placeType: input.placeType,
      });
      return {
        data: {
          source: 'google_maps',
          verifiedInternally: false,
          attribution: 'Google Maps',
          items: candidates.map((candidate) =>
            this.toProviderPreview(candidate),
          ),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('MAP_PROVIDER_UNAVAILABLE');
    }
  }

  private toProviderPreview(candidate: MapPlacePreview) {
    return {
      ...candidate,
      source: 'google_maps' as const,
      verifiedInternally: false as const,
    };
  }

  private assertAreaOrLocation(
    input: MapFacilitySearchInput,
    required: boolean,
  ) {
    const area = input.area?.trim();
    if (input.area !== undefined && (!area || area.length > 100))
      throw new BadRequestException('MAP_SEARCH_AREA_INVALID');
    if (input.area !== undefined && input.location)
      throw new BadRequestException('CHOOSE_AREA_OR_LOCATION');
    if (required && Boolean(area) === Boolean(input.location))
      throw new BadRequestException(
        'SPECIALTY_SEARCH_AREA_OR_LOCATION_REQUIRED',
      );
    if (input.radiusKm !== undefined && !input.location)
      throw new BadRequestException('RADIUS_REQUIRES_LOCATION');
  }

  private assertLocationAndRadius(
    input: MapFacilitySearchInput,
    radiusKm: number,
  ) {
    if (
      !Number.isInteger(radiusKm) ||
      radiusKm < 1 ||
      radiusKm > 50 ||
      (input.location &&
        (!Number.isFinite(input.location.longitude) ||
          input.location.longitude < -180 ||
          input.location.longitude > 180 ||
          !Number.isFinite(input.location.latitude) ||
          input.location.latitude < -90 ||
          input.location.latitude > 90))
    )
      throw new BadRequestException('INVALID_MAP_SEARCH');
  }

  private async assertSuperAdmin(actorId: string) {
    if (!(await this.admins.isSuperAdmin(actorId)))
      throw new ForbiddenException('SUPER_ADMIN_REQUIRED');
  }

  private assertProviderEnabled() {
    if (!this.config.get<boolean>('GOOGLE_MAPS_PLACES_ENABLED', false))
      throw new ServiceUnavailableException('MAP_PROVIDER_DISABLED');
  }
}
