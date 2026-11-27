export type FacilityStatus = 'draft' | 'verified' | 'retired';
export type FacilityRevisionStatus = 'draft' | 'verified' | 'superseded';
export type FacilityType =
  | 'hospital'
  | 'general_hospital'
  | 'medical_center'
  | 'clinic';
export type MappingStatus = 'draft' | 'published' | 'retired';
export type MappingScope = 'program' | 'disease';

export interface FacilityPoint {
  type: 'Point';
  coordinates: [longitude: number, latitude: number];
}

export interface FacilityAddress {
  street?: string;
  ward?: string;
  district?: string;
  province: string;
  provinceCode: 'HCMC';
  country: 'VN';
}

export interface FacilityContact {
  phone?: string;
  website?: string;
  bookingUrl?: string;
}

export interface FacilityDetails {
  name: string;
  normalizedName: string;
  facilityType: FacilityType;
  address: FacilityAddress;
  location: FacilityPoint;
  specialtyCodes: string[];
  services?: string[];
  contact?: FacilityContact;
  officialSourceUrl: string;
}

export type FacilityDraftDetails = Partial<FacilityDetails>;

export interface FacilitySearchCriteria {
  specialtyCodes: string[];
  area?: string;
  location?: { longitude: number; latitude: number };
  radiusKm: number;
  page: number;
  limit: number;
  now: Date;
  staleAfterDays: number;
  reasonCode: 'manual_specialty' | 'program_mapping' | 'disease_mapping';
}

export interface FacilitySearchItem {
  id: string;
  name: string;
  facilityType: FacilityType;
  address: FacilityAddress;
  matchedSpecialtyCodes: string[];
  contact?: FacilityContact;
  distanceMeters?: number;
  source: 'officially_verified_internal';
  verificationLabel: 'verified' | 'needs_recheck';
  lastCheckedAt: string;
  reasonCode: string;
}

export interface FacilitySearchPage {
  items: FacilitySearchItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNextPage: boolean;
  };
}

export interface SpecialtyRecord {
  code: string;
  nameVi: string;
  synonyms: string[];
  status: 'active' | 'retired';
  revision: number;
}

export interface SpecialtyMappingRecord {
  id: string;
  scope: MappingScope;
  scopeKey: string;
  version: number;
  revision: number;
  status: MappingStatus;
  specialtyCodes: string[];
  sourceReferences: string[];
  publishedAt?: string;
}

export interface FacilityAdminRecord {
  id: string;
  status: FacilityStatus;
  revision: number;
  googlePlaceId?: string;
  details?: FacilityDraftDetails;
  currentDetails?: FacilityDetails;
  draftDetails?: FacilityDraftDetails;
  currentRevisionId?: string;
  draftRevisionId?: string;
  lastCheckedAt?: string;
  verifiedAt?: string;
  needsRecheck?: boolean;
  duplicateDecisions?: FacilityDuplicateDecisionView[];
}

export interface FacilityDuplicateDecisionView {
  candidateFacilityId: string;
  reason: string;
  reviewedBy: string;
  reviewedAt: string;
}

export interface FacilityRevisionRecord {
  id: string;
  facilityId: string;
  version: number;
  revision: number;
  status: FacilityRevisionStatus;
  details: FacilityDraftDetails;
}

export interface NewFacilityDetails {
  name: string;
  facilityType: FacilityType;
  address: FacilityAddress;
  location: FacilityPoint;
  specialtyCodes: string[];
  services?: string[];
  contact?: FacilityContact;
  officialSourceUrl: string;
}

export function normalizeFacilityName(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('vi-VN')
    .replace(/\s+/g, ' ');
}
