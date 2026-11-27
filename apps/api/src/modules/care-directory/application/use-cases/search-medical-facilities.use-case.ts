import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { chooseMapping } from '../../domain/policies/mapping-policy';
import type { FacilitySearchCriteria } from '../../domain/care-directory.types';
import { validateFacilitySearchCriteria } from '../../domain/policies/facility-policy';
import {
  CARE_DIRECTORY_PROGRAM_CATALOG,
  CARE_DIRECTORY_QUERY_REPOSITORY,
  type CareDirectoryProgramCatalog,
  type CareDirectoryQueryRepository,
} from '../ports/care-directory.ports';

export interface SearchMedicalFacilitiesInput {
  specialtyCode?: string;
  programCode?: string;
  diseaseKey?: string;
  area?: string;
  location?: { longitude: number; latitude: number };
  locationConsent?: boolean;
  radiusKm?: number;
  page?: number;
  limit?: number;
}

@Injectable()
export class SearchMedicalFacilities {
  constructor(
    @Inject(CARE_DIRECTORY_QUERY_REPOSITORY)
    private readonly directory: CareDirectoryQueryRepository,
    @Inject(CARE_DIRECTORY_PROGRAM_CATALOG)
    private readonly programs: CareDirectoryProgramCatalog,
    private readonly config: ConfigService,
  ) {}

  async execute(_patientId: string, input: SearchMedicalFacilitiesInput) {
    this.assertEnabled();
    const normalizedInput = {
      ...input,
      specialtyCode: input.specialtyCode?.trim().toLowerCase(),
      programCode: input.programCode?.trim(),
      diseaseKey: input.diseaseKey?.trim().toLowerCase(),
      area: input.area?.trim(),
    };
    const selectors = [
      normalizedInput.specialtyCode,
      normalizedInput.programCode,
      normalizedInput.diseaseKey,
    ].filter(Boolean);
    if (selectors.length !== 1)
      throw new BadRequestException(
        'Choose exactly one specialty, Program or disease.',
      );
    if (normalizedInput.location && normalizedInput.locationConsent !== true)
      throw new BadRequestException('Explicit location consent is required.');
    if (normalizedInput.location && normalizedInput.area)
      throw new BadRequestException(
        'Choose either an area or a precise location.',
      );
    if (normalizedInput.area !== undefined && !normalizedInput.area)
      throw new BadRequestException('FACILITY_AREA_INVALID');
    if (!normalizedInput.location && !normalizedInput.area)
      throw new BadRequestException('Choose an area or provide a location.');

    let specialtyCodes: string[];
    let reasonCode: FacilitySearchCriteria['reasonCode'];
    let mappingStatus: 'matched' | 'manual_specialty_required' = 'matched';
    let mappingSource:
      | 'program_mapping'
      | 'disease_mapping'
      | 'manual_specialty'
      | null = null;
    if (normalizedInput.specialtyCode) {
      const specialty = await this.directory.getActiveSpecialty(
        normalizedInput.specialtyCode,
      );
      if (!specialty) throw new NotFoundException('SPECIALTY_NOT_FOUND');
      specialtyCodes = [specialty.code];
      reasonCode = 'manual_specialty';
      mappingSource = 'manual_specialty';
    } else {
      let diseaseKey = normalizedInput.diseaseKey;
      if (normalizedInput.programCode) {
        const program = await this.programs.findPublishedProgram(
          normalizedInput.programCode,
        );
        if (!program)
          throw new NotFoundException('PUBLISHED_PROGRAM_NOT_FOUND');
        diseaseKey = program.diseaseKey;
      } else if (
        diseaseKey &&
        !(await this.programs.hasPublishedProgramForDisease(diseaseKey))
      ) {
        throw new NotFoundException('PUBLISHED_DISEASE_NOT_FOUND');
      }
      const programMapping = normalizedInput.programCode
        ? await this.directory.findPublishedMapping(
            'program',
            normalizedInput.programCode,
          )
        : null;
      const diseaseMapping = diseaseKey
        ? await this.directory.findPublishedMapping('disease', diseaseKey)
        : null;
      const resolution = chooseMapping({
        programCode: normalizedInput.programCode,
        diseaseKey,
        programMappings: programMapping ? [programMapping] : [],
        diseaseMappings: diseaseMapping ? [diseaseMapping] : [],
      });
      if (!resolution.mapping || !resolution.source) {
        mappingStatus = 'manual_specialty_required';
        return {
          data: {
            mappingStatus,
            mappingSource: null,
            items: [],
            pagination: {
              page: normalizedInput.page ?? 1,
              limit: normalizedInput.limit ?? 20,
              total: 0,
              hasNextPage: false,
            },
          },
        };
      }
      specialtyCodes = resolution.mapping.specialtyCodes;
      reasonCode = resolution.source;
      mappingSource = resolution.source;
    }

    const activeSpecialties = await Promise.all(
      specialtyCodes.map((code) => this.directory.getActiveSpecialty(code)),
    );
    specialtyCodes = activeSpecialties
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => item.code);
    if (specialtyCodes.length === 0) {
      mappingStatus = 'manual_specialty_required';
      return {
        data: {
          mappingStatus,
          mappingSource: null,
          items: [],
          pagination: {
            page: input.page ?? 1,
            limit: input.limit ?? 20,
            total: 0,
            hasNextPage: false,
          },
        },
      };
    }
    const criteria: FacilitySearchCriteria = {
      specialtyCodes,
      area: normalizedInput.area,
      location: normalizedInput.location,
      radiusKm: normalizedInput.radiusKm ?? 10,
      page: normalizedInput.page ?? 1,
      limit: normalizedInput.limit ?? 20,
      now: new Date(),
      staleAfterDays: this.config.get<number>('FACILITY_FRESHNESS_DAYS', 180),
      reasonCode,
    };
    try {
      validateFacilitySearchCriteria(criteria);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'INVALID_FACILITY_SEARCH',
      );
    }
    const result = await this.directory.searchVerifiedFacilities(criteria);
    return { data: { mappingStatus, mappingSource, ...result } };
  }

  private assertEnabled() {
    if (!this.config.get<boolean>('FACILITY_DIRECTORY_ENABLED', false))
      throw new ServiceUnavailableException('FACILITY_DIRECTORY_DISABLED');
  }
}
