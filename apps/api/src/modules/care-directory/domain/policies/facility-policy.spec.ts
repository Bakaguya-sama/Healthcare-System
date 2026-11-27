import {
  facilityNeedsRecheck,
  validateFacilityDetails,
  validateFacilitySearchCriteria,
} from './facility-policy';

describe('facility directory policies', () => {
  const details = {
    name: 'Phòng khám tim mạch',
    facilityType: 'clinic' as const,
    address: {
      province: 'Thành phố Hồ Chí Minh',
      provinceCode: 'HCMC' as const,
      country: 'VN' as const,
      district: 'Quận 1',
    },
    location: { type: 'Point' as const, coordinates: [106.7, 10.77] as [number, number] },
    specialtyCodes: ['cardiology'],
    contact: { phone: '0280000000', website: 'https://example.org' },
    officialSourceUrl: 'https://example.org/facility',
  };

  it('normalizes facility data while preserving the HCMC pilot boundary', () => {
    const result = validateFacilityDetails(details);
    expect(result.address.province).toBe('Thành phố Hồ Chí Minh');
    expect(result.normalizedName).toBe('phòng khám tim mạch');
    expect(result.specialtyCodes).toEqual(['cardiology']);
  });

  it('rejects incomplete or unsafe data before verification', () => {
    expect(() => validateFacilityDetails({ ...details, specialtyCodes: ['cardiology', ' CARDIOLOGY '] })).toThrow('FACILITY_SPECIALTIES_REQUIRED');
    expect(() => validateFacilityDetails({ ...details, specialtyCodes: [] })).toThrow('FACILITY_SPECIALTIES_REQUIRED');
    expect(() => validateFacilityDetails({ ...details, officialSourceUrl: 'http://example.org' })).toThrow('FACILITY_OFFICIAL_SOURCE_REQUIRED');
    expect(() => validateFacilityDetails({ ...details, contact: undefined })).toThrow('FACILITY_CONTACT_REQUIRED');
    expect(() => validateFacilityDetails({ ...details, contact: { website: 'https://localhost' } })).toThrow('FACILITY_WEBSITE_INVALID');
    expect(() => validateFacilityDetails({ ...details, contact: { phone: '123456789', website: 'https://clinic.example.org', bookingUrl: 'https://unrelated-booking.example/book' } })).toThrow('FACILITY_BOOKING_URL_INVALID');
    expect(() => validateFacilityDetails({ ...details, address: { ...details.address, provinceCode: 'OTHER' as 'HCMC' } })).toThrow('FACILITY_OUTSIDE_PILOT_AREA');
    expect(() => validateFacilityDetails({ ...details, location: { type: 'Point', coordinates: [200, 10] } })).toThrow('FACILITY_LOCATION_INVALID');
  });

  it('derives the 180-day freshness label without changing facility status', () => {
    const now = new Date('2026-11-25T00:00:00.000Z');
    expect(facilityNeedsRecheck(new Date('2026-05-29T00:00:00.000Z'), now, 180)).toBe(false);
    expect(facilityNeedsRecheck(new Date('2026-05-28T00:00:00.000Z'), now, 180)).toBe(true);
  });

  it('rejects blank areas and out-of-range search settings', () => {
    const base = { specialtyCodes: ['cardiology'], radiusKm: 10, page: 1, limit: 20, now: new Date(), staleAfterDays: 180, reasonCode: 'manual_specialty' as const };
    expect(() => validateFacilitySearchCriteria({ ...base, area: '  ' })).toThrow('FACILITY_AREA_INVALID');
    expect(() => validateFacilitySearchCriteria({ ...base, location: { longitude: 106, latitude: 10 }, radiusKm: 51 })).toThrow('FACILITY_RADIUS_INVALID');
    expect(() => validateFacilitySearchCriteria({ ...base, page: 1, limit: 51 })).toThrow('FACILITY_PAGE_INVALID');
  });
});
