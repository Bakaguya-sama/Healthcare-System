import { isIP } from 'node:net';
import type {
  FacilityDetails,
  FacilityPoint,
  FacilitySearchCriteria,
  FacilityType,
  NewFacilityDetails,
} from '../care-directory.types';

const FACILITY_TYPES = new Set<FacilityType>([
  'hospital',
  'general_hospital',
  'medical_center',
  'clinic',
]);

export function validateFacilityDetails(
  input: NewFacilityDetails,
): FacilityDetails {
  if (
    !input ||
    typeof input.name !== 'string' ||
    !input.address ||
    typeof input.address.province !== 'string' ||
    !Array.isArray(input.specialtyCodes) ||
    typeof input.officialSourceUrl !== 'string'
  )
    throw new Error('FACILITY_DETAILS_INCOMPLETE');
  const name = input.name.trim();
  const province = input.address.province.trim();
  if (name.length < 2 || name.length > 180)
    throw new Error('FACILITY_NAME_INVALID');
  if (!FACILITY_TYPES.has(input.facilityType))
    throw new Error('FACILITY_TYPE_INVALID');
  const normalizedProvince = province
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (
    input.address.provinceCode !== 'HCMC' ||
    input.address.country !== 'VN' ||
    ![
      'thanh pho ho chi minh',
      'thanh pho hcm',
      'ho chi minh city',
      'ho chi minh',
      'tp ho chi minh',
      'tp hcm',
      'tphcm',
      'hcmc',
    ].includes(normalizedProvince)
  )
    throw new Error('FACILITY_OUTSIDE_PILOT_AREA');
  if (!province || !input.location || !isValidPoint(input.location))
    throw new Error('FACILITY_LOCATION_INVALID');
  const specialtyCodes = input.specialtyCodes.map((code) =>
    code.trim().toLowerCase(),
  );
  if (
    !specialtyCodes.length ||
    specialtyCodes.some((code) => !code) ||
    new Set(specialtyCodes).size !== specialtyCodes.length
  )
    throw new Error('FACILITY_SPECIALTIES_REQUIRED');
  if (!isHttpsUrl(input.officialSourceUrl))
    throw new Error('FACILITY_OFFICIAL_SOURCE_REQUIRED');
  if (
    !input.contact ||
    (!input.contact.phone?.trim() &&
      !input.contact.website?.trim() &&
      !input.contact.bookingUrl?.trim())
  )
    throw new Error('FACILITY_CONTACT_REQUIRED');
  if (
    input.contact.phone &&
    !/^[+0-9(). -]{7,40}$/.test(input.contact.phone.trim())
  )
    throw new Error('FACILITY_PHONE_INVALID');
  if (input.contact?.website && !isSafePublicHttpsUrl(input.contact.website))
    throw new Error('FACILITY_WEBSITE_INVALID');
  if (
    input.contact?.bookingUrl &&
    (!isSafePublicHttpsUrl(input.contact.bookingUrl) ||
      !belongsToVerifiedHost(input.contact.bookingUrl, [
        input.contact.website,
        input.officialSourceUrl,
      ]))
  )
    throw new Error('FACILITY_BOOKING_URL_INVALID');
  return {
    ...input,
    name,
    normalizedName: name
      .normalize('NFKC')
      .trim()
      .toLocaleLowerCase('vi-VN')
      .replace(/\s+/g, ' '),
    address: { ...input.address, province: 'Thành phố Hồ Chí Minh' },
    specialtyCodes: specialtyCodes.sort(),
    services: input.services?.map((item) => item.trim()).filter(Boolean),
  };
}

export function isValidPoint(point: FacilityPoint): boolean {
  const [longitude, latitude] = point.coordinates;
  return (
    point.type === 'Point' &&
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}

export function isHttpsUrl(value: string): boolean {
  return isSafePublicHttpsUrl(value);
}

function isSafePublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    return (
      url.protocol === 'https:' &&
      Boolean(hostname) &&
      !url.username &&
      !url.password &&
      !isIP(hostname) &&
      hostname !== 'localhost' &&
      !hostname.endsWith('.localhost') &&
      !hostname.endsWith('.local') &&
      !hostname.endsWith('.internal')
    );
  } catch {
    return false;
  }
}

function belongsToVerifiedHost(
  candidate: string,
  trustedUrls: Array<string | undefined>,
): boolean {
  try {
    const host = new URL(candidate).hostname.toLowerCase().replace(/\.$/, '');
    return trustedUrls.some((trusted) => {
      if (!trusted) return false;
      const trustedHost = new URL(trusted).hostname
        .toLowerCase()
        .replace(/\.$/, '');
      return host === trustedHost || host.endsWith(`.${trustedHost}`);
    });
  } catch {
    return false;
  }
}

export function facilityNeedsRecheck(
  lastCheckedAt: Date,
  now: Date,
  staleAfterDays: number,
): boolean {
  return now.getTime() - lastCheckedAt.getTime() > staleAfterDays * 86_400_000;
}

export function validateFacilitySearchCriteria(
  input: FacilitySearchCriteria,
): void {
  if (input.specialtyCodes.length === 0) throw new Error('SPECIALTY_REQUIRED');
  if (input.page < 1 || input.limit < 1 || input.limit > 50)
    throw new Error('FACILITY_PAGE_INVALID');
  if (input.location && (input.radiusKm < 1 || input.radiusKm > 50))
    throw new Error('FACILITY_RADIUS_INVALID');
  if (
    input.location &&
    (!Number.isFinite(input.location.longitude) ||
      !Number.isFinite(input.location.latitude) ||
      input.location.longitude < -180 ||
      input.location.longitude > 180 ||
      input.location.latitude < -90 ||
      input.location.latitude > 90)
  )
    throw new Error('FACILITY_LOCATION_INVALID');
  if (
    input.area !== undefined &&
    (!input.area.trim() || input.area.trim().length > 100)
  )
    throw new Error('FACILITY_AREA_INVALID');
}
