import type {
  FacilityAdminRecord,
  FacilityDraftDetails,
  FacilityRevisionRecord,
  FacilitySearchCriteria,
  FacilitySearchPage,
  MappingScope,
  SpecialtyMappingRecord,
  SpecialtyRecord,
} from '../../domain/care-directory.types';
import type { FacilityDuplicateReviewInput } from '../../domain/policies/facility-duplicate-policy';

export const CARE_DIRECTORY_QUERY_REPOSITORY = Symbol(
  'CARE_DIRECTORY_QUERY_REPOSITORY',
);
export const SPECIALTY_CATALOG_REPOSITORY = Symbol(
  'SPECIALTY_CATALOG_REPOSITORY',
);
export const DISEASE_SPECIALTY_MAPPING_REPOSITORY = Symbol(
  'DISEASE_SPECIALTY_MAPPING_REPOSITORY',
);
export const MEDICAL_FACILITY_REPOSITORY = Symbol(
  'MEDICAL_FACILITY_REPOSITORY',
);
export const FACILITY_ADMIN_AUTHORITY = Symbol('FACILITY_ADMIN_AUTHORITY');
export const CARE_DIRECTORY_PROGRAM_CATALOG = Symbol(
  'CARE_DIRECTORY_PROGRAM_CATALOG',
);
export const MAP_PROVIDER = Symbol('MAP_PROVIDER');
export const MAP_PROVIDER_REQUEST_LIMITER = Symbol(
  'MAP_PROVIDER_REQUEST_LIMITER',
);

/** Google Places Text Search Table A health-related types accepted by `includedType`. */
export const GOOGLE_PLACE_TYPE_FILTERS = [
  'chiropractor',
  'dental_clinic',
  'dentist',
  'doctor',
  'drugstore',
  'general_hospital',
  'hospital',
  'medical_center',
  'medical_clinic',
  'medical_lab',
  'pharmacy',
  'physiotherapist',
  'skin_care_clinic',
  'wellness_center',
] as const;

export type GooglePlaceTypeFilter = (typeof GOOGLE_PLACE_TYPE_FILTERS)[number];

export interface MapPlacePreview {
  placeId: string;
  name?: string;
  address?: string;
  location?: { longitude: number; latitude: number };
  mapsUrl?: string;
  attribution: 'Google Maps';
  thirdPartyAttributions?: Array<{ provider: string; providerUrl?: string }>;
}

export interface CareDirectoryQueryRepository {
  listActiveSpecialties(): Promise<SpecialtyRecord[]>;
  getActiveSpecialty(code: string): Promise<SpecialtyRecord | null>;
  findPublishedMapping(
    scope: MappingScope,
    scopeKey: string,
  ): Promise<SpecialtyMappingRecord | null>;
  searchVerifiedFacilities(
    criteria: FacilitySearchCriteria,
  ): Promise<FacilitySearchPage>;
  getVerifiedFacility(
    id: string,
    now: Date,
    staleAfterDays: number,
  ): Promise<Record<string, unknown> | null>;
}

export interface SpecialtyCatalogRepository {
  listAdminSpecialties(input: { status?: string }): Promise<SpecialtyRecord[]>;
  createSpecialty(input: {
    code: string;
    nameVi: string;
    synonyms: string[];
    actorId: string;
    key: string;
  }): Promise<SpecialtyRecord>;
  updateSpecialty(input: {
    code: string;
    nameVi: string;
    synonyms: string[];
    expectedRevision: number;
    actorId: string;
    key: string;
  }): Promise<SpecialtyRecord>;
  retireSpecialty(input: {
    code: string;
    reason: string;
    expectedRevision: number;
    actorId: string;
    key: string;
  }): Promise<{ retired: true }>;
}

export interface DiseaseSpecialtyMappingRepository {
  listMappings(input: {
    scope?: MappingScope;
    scopeKey?: string;
    status?: string;
  }): Promise<SpecialtyMappingRecord[]>;
  createMapping(input: {
    scope: MappingScope;
    scopeKey: string;
    specialtyCodes: string[];
    sourceReferences: string[];
    actorId: string;
    key: string;
  }): Promise<SpecialtyMappingRecord>;
  updateMapping(input: {
    id: string;
    specialtyCodes: string[];
    sourceReferences: string[];
    expectedRevision: number;
    actorId: string;
    key: string;
  }): Promise<SpecialtyMappingRecord>;
  publishMapping(input: {
    id: string;
    expectedRevision: number;
    actorId: string;
    key: string;
  }): Promise<SpecialtyMappingRecord>;
  retireMapping(input: {
    id: string;
    reason: string;
    expectedRevision: number;
    actorId: string;
    key: string;
  }): Promise<{ retired: true }>;
}

export interface MedicalFacilityRepository {
  listAdminFacilities(input: {
    status?: string;
    needsRecheck?: boolean;
    staleBefore?: Date;
    page: number;
    limit: number;
  }): Promise<{ items: FacilityAdminRecord[]; total: number }>;
  getAdminFacility(id: string): Promise<FacilityAdminRecord | null>;
  createFacilityDraft(input: {
    details: FacilityDraftDetails;
    duplicateReview?: FacilityDuplicateReviewInput;
    actorId: string;
    key: string;
  }): Promise<FacilityAdminRecord>;
  createFacilityDraftFromPlace(input: {
    placeId: string;
    providerPreview: MapPlacePreview;
    duplicateReview?: FacilityDuplicateReviewInput;
    actorId: string;
    key: string;
  }): Promise<FacilityAdminRecord>;
  findCreateFacilityDraftFromPlaceReplay(input: {
    placeId: string;
    duplicateReview?: FacilityDuplicateReviewInput;
    actorId: string;
    key: string;
  }): Promise<FacilityAdminRecord | null>;
  findFacilityByGooglePlaceId(
    placeId: string,
  ): Promise<FacilityAdminRecord | null>;
  findUpdateFacilityMetadataReplay(input: {
    id: string;
    placeId: string;
    expectedRevision: number;
    actorId: string;
    key: string;
  }): Promise<FacilityAdminRecord | null>;
  updateFacilityMetadata(input: {
    id: string;
    placeId: string;
    expectedRevision: number;
    actorId: string;
    key: string;
  }): Promise<FacilityAdminRecord>;
  updateFacilityDraft(input: {
    id: string;
    revisionId?: string;
    details: FacilityDraftDetails;
    expectedRevision: number;
    actorId: string;
    key: string;
  }): Promise<FacilityAdminRecord>;
  createFacilityRevision(input: {
    id: string;
    actorId: string;
    key: string;
  }): Promise<FacilityRevisionRecord>;
  verifyFacility(input: {
    id: string;
    revisionId: string;
    expectedRevision: number;
    providerDataReviewedAgainstOfficialSource?: boolean;
    duplicateReview?: FacilityDuplicateReviewInput;
    actorId: string;
    key: string;
  }): Promise<FacilityAdminRecord>;
  retireFacility(input: {
    id: string;
    reason: string;
    expectedRevision: number;
    actorId: string;
    key: string;
  }): Promise<{ retired: true }>;
}

export interface FacilityAdminAuthority {
  isSuperAdmin(actorId: string): Promise<boolean>;
}

export interface CareDirectoryProgramCatalog {
  findPublishedProgram(
    programCode: string,
  ): Promise<{ programCode: string; diseaseKey: string } | null>;
  hasPublishedProgramForDisease(diseaseKey: string): Promise<boolean>;
}

export interface MapProvider {
  search(input: {
    actorId: string;
    query?: string;
    specialtyName?: string;
    area?: string;
    location?: { longitude: number; latitude: number };
    radiusKm: number;
    placeType?: GooglePlaceTypeFilter;
  }): Promise<MapPlacePreview[]>;
  findPlace(placeId: string, actorId: string): Promise<MapPlacePreview>;
}

export interface MapProviderRequestLimiter {
  assertAllowed(actorId: string): Promise<void>;
}
