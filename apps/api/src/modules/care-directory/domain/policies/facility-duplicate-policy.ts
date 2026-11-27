import type {
  FacilityAddress,
  FacilityPoint,
  FacilityStatus,
} from '../care-directory.types';

export const FACILITY_DUPLICATE_NEARBY_METERS = 100;
export const FACILITY_DUPLICATE_CANDIDATE_LIMIT = 50;

const GENERIC_SEARCH_WORDS = new Set([
  'benh',
  'benhvien',
  'chi',
  'co',
  'clinic',
  'city',
  'co-so',
  'hcm',
  'hcmc',
  'ho',
  'hospital',
  'kham',
  'medical',
  'nhanh',
  'phong',
  'quan',
  'so',
  'tam',
  'thanh',
  'thanhpho',
  'tp',
  'trung',
  'tu',
  'vien',
  'y',
  'te',
]);

export type FacilityDuplicateReasonCode =
  | 'similar_name'
  | 'similar_address'
  | 'nearby_location';

export interface FacilityDuplicateSubject {
  id?: string;
  status?: FacilityStatus;
  revision?: number;
  googlePlaceId?: string;
  name?: string;
  address?: FacilityAddress | string;
  location?: FacilityPoint | { longitude: number; latitude: number };
}

export interface PossibleFacilityDuplicate {
  id: string;
  status: FacilityStatus;
  revision: number;
  name?: string;
  address?: FacilityAddress;
  googlePlaceId?: string;
  reasonCodes: FacilityDuplicateReasonCode[];
  distanceMeters?: number;
}

export interface FacilityDuplicateReviewInput {
  confirmedDistinct: true;
  reason: string;
  reviewedFacilityIds: string[];
}

export interface FacilityDuplicateDecision {
  facilityId: string;
  candidateFacilityId: string;
  actorId: string;
  reason: string;
  decidedAt: Date;
}

export class FacilityDuplicateReviewRequiredError extends Error {
  readonly code = 'FACILITY_POSSIBLE_DUPLICATE';

  constructor(
    readonly candidates: PossibleFacilityDuplicate[],
    readonly truncated: boolean,
  ) {
    super('FACILITY_POSSIBLE_DUPLICATE');
    this.name = 'FacilityDuplicateReviewRequiredError';
  }
}

export class FacilityPlaceIdConflictError extends Error {
  readonly code = 'FACILITY_GOOGLE_PLACE_ALREADY_LINKED';

  constructor(readonly facility: object) {
    super('FACILITY_GOOGLE_PLACE_ALREADY_LINKED');
    this.name = 'FacilityPlaceIdConflictError';
  }
}

export class FacilityDuplicateReviewCandidateMismatchError extends Error {
  readonly code = 'FACILITY_DUPLICATE_REVIEW_CANDIDATE_NOT_CURRENT';

  constructor() {
    super('FACILITY_DUPLICATE_REVIEW_CANDIDATE_NOT_CURRENT');
    this.name = 'FacilityDuplicateReviewCandidateMismatchError';
  }
}

export function validateDistinctFacilityReview(
  review: FacilityDuplicateReviewInput | undefined,
): FacilityDuplicateReviewInput | undefined {
  if (review === undefined) return undefined;
  const ids = review.reviewedFacilityIds;
  if (
    review.confirmedDistinct !== true ||
    typeof review.reason !== 'string' ||
    review.reason.trim().length < 10 ||
    review.reason.trim().length > 300 ||
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > FACILITY_DUPLICATE_CANDIDATE_LIMIT ||
    ids.some((id) => typeof id !== 'string' || !id.trim()) ||
    new Set(ids).size !== ids.length
  )
    throw new Error('FACILITY_DUPLICATE_REVIEW_INVALID');
  return {
    confirmedDistinct: true,
    reason: review.reason.trim(),
    reviewedFacilityIds: [...ids],
  };
}

/** Stable, accent-insensitive tokens are derived only from internally held Facility fields. */
export function facilityDuplicateSearchTokens(
  subject: FacilityDuplicateSubject,
): string[] {
  const address = addressText(subject.address);
  const all = normalizeDuplicateText(`${subject.name ?? ''} ${address}`)
    .split(' ')
    .filter(
      (token) =>
        (token.length >= 2 || /^\d+$/.test(token)) &&
        !GENERIC_SEARCH_WORDS.has(token),
    );
  return [...new Set(all)].sort().slice(0, 50);
}

export function findDuplicateReasons(
  left: FacilityDuplicateSubject,
  right: FacilityDuplicateSubject,
): FacilityDuplicateReasonCode[] {
  if (!left.name?.trim() || !right.name?.trim()) return [];
  const nameSimilarity = facilityNameSimilarity(left.name, right.name);
  const similarAddress = facilityAddressesSimilar(left.address, right.address);
  const distanceMeters = distanceBetween(left.location, right.location);
  const similarName = nameSimilarity >= 0.84;
  const nearby =
    distanceMeters !== undefined &&
    distanceMeters <= FACILITY_DUPLICATE_NEARBY_METERS;

  // A matching name alone or a nearby point alone is not enough: branches and
  // facilities in the same building are valid. Require a second signal.
  if (!similarName || (!similarAddress && !nearby)) return [];

  return [
    'similar_name',
    ...(similarAddress ? (['similar_address'] as const) : []),
    ...(nearby ? (['nearby_location'] as const) : []),
  ];
}

export function facilityDuplicateDistanceMeters(
  left: FacilityDuplicateSubject['location'],
  right: FacilityDuplicateSubject['location'],
): number | undefined {
  return distanceBetween(left, right);
}

export function normalizeDuplicateText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (character) => (character === 'Đ' ? 'D' : 'd'))
    .toLocaleLowerCase('vi-VN')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function addressText(address: FacilityDuplicateSubject['address']): string {
  if (!address) return '';
  if (typeof address === 'string') return address;
  return [address.street, address.ward, address.district, address.province]
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

function facilityNameSimilarity(left: string, right: string): number {
  const leftTokens = significantFacilityTokens(left);
  const rightTokens = significantFacilityTokens(right);
  if (!leftTokens.length || !rightTokens.length) return 0;

  const unmatchedRight = new Set(rightTokens.map((_, index) => index));
  let matches = 0;
  for (const leftToken of leftTokens) {
    const exact = [...unmatchedRight].find(
      (index) => rightTokens[index] === leftToken,
    );
    if (exact !== undefined) {
      unmatchedRight.delete(exact);
      matches += 1;
      continue;
    }
    if (leftToken.length < 4) continue;
    const near = [...unmatchedRight].find((index) => {
      const rightToken = rightTokens[index];
      if (rightToken.length < 4) return false;
      const length = Math.max(leftToken.length, rightToken.length);
      return 1 - levenshteinDistance(leftToken, rightToken) / length >= 0.8;
    });
    if (near !== undefined) {
      unmatchedRight.delete(near);
      matches += 1;
    }
  }
  return matches / Math.max(leftTokens.length, rightTokens.length);
}

function significantFacilityTokens(value: string): string[] {
  return normalizeDuplicateText(value)
    .split(' ')
    .filter(
      (token) =>
        (token.length >= 2 || /^\d+$/.test(token)) &&
        !GENERIC_SEARCH_WORDS.has(token),
    );
}

function facilityAddressesSimilar(
  left: FacilityDuplicateSubject['address'],
  right: FacilityDuplicateSubject['address'],
): boolean {
  if (!left || !right) return false;
  const normalizedLeft = normalizeDuplicateText(addressText(left));
  const normalizedRight = normalizeDuplicateText(addressText(right));
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const leftDistrict = districtFromAddress(normalizedLeft);
  const rightDistrict = districtFromAddress(normalizedRight);
  if (leftDistrict && rightDistrict && leftDistrict !== rightDistrict)
    return false;

  if (typeof left === 'string' || typeof right === 'string')
    return (
      tokenContainmentSimilarity(normalizedLeft, normalizedRight) >= 0.75 ||
      textSimilarity(normalizedLeft, normalizedRight) >= 0.75
    );

  const leftDistrictField =
    districtFromAddress(normalizeDuplicateText(left.district ?? '')) ??
    normalizeDuplicateText(left.district ?? '');
  const rightDistrictField =
    districtFromAddress(normalizeDuplicateText(right.district ?? '')) ??
    normalizeDuplicateText(right.district ?? '');
  const leftWard = normalizeDuplicateText(left.ward ?? '');
  const rightWard = normalizeDuplicateText(right.ward ?? '');
  if (
    leftDistrictField &&
    rightDistrictField &&
    leftDistrictField !== rightDistrictField
  )
    return false;
  if (leftWard && rightWard && leftWard !== rightWard) return false;

  const leftStreet = normalizeDuplicateText(left.street ?? '');
  const rightStreet = normalizeDuplicateText(right.street ?? '');
  if (
    leftStreet &&
    rightStreet &&
    textSimilarity(leftStreet, rightStreet) >= 0.8
  )
    return true;

  return Boolean(
    leftDistrictField &&
    rightDistrictField &&
    leftDistrictField === rightDistrictField &&
    leftWard &&
    rightWard &&
    leftWard === rightWard,
  );
}

function districtFromAddress(normalizedAddress: string): string | undefined {
  return normalizedAddress.match(/\b(?:quan|district|q)\s*([a-z0-9]+)\b/)?.[1];
}

function textSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeDuplicateText(left);
  const normalizedRight = normalizeDuplicateText(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const leftTokens = new Set(normalizedLeft.split(' '));
  const rightTokens = new Set(normalizedRight.split(' '));
  const shared = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  ).length;
  const tokenSimilarity =
    shared / new Set([...leftTokens, ...rightTokens]).size;
  const length = Math.max(normalizedLeft.length, normalizedRight.length);
  const editSimilarity =
    1 - levenshteinDistance(normalizedLeft, normalizedRight) / length;
  return Math.max(tokenSimilarity, editSimilarity);
}

function tokenContainmentSimilarity(left: string, right: string): number {
  const leftTokens = new Set(left.split(' ').filter(Boolean));
  const rightTokens = new Set(right.split(' ').filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const shared = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  ).length;
  return shared / Math.min(leftTokens.size, rightTokens.size);
}

function levenshteinDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function distanceBetween(
  left: FacilityDuplicateSubject['location'],
  right: FacilityDuplicateSubject['location'],
): number | undefined {
  const leftPoint = coordinates(left);
  const rightPoint = coordinates(right);
  if (!leftPoint || !rightPoint) return undefined;
  const [leftLongitude, leftLatitude] = leftPoint;
  const [rightLongitude, rightLatitude] = rightPoint;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(rightLatitude - leftLatitude);
  const longitudeDelta = radians(rightLongitude - leftLongitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(leftLatitude)) *
      Math.cos(radians(rightLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function coordinates(
  location: FacilityDuplicateSubject['location'],
): [number, number] | undefined {
  if (!location) return undefined;
  const point =
    'coordinates' in location
      ? location.coordinates
      : [location.longitude, location.latitude];
  const [longitude, latitude] = point;
  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  )
    return undefined;
  return [longitude, latitude];
}
