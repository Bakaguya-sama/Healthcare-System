import {
  facilityDuplicateSearchTokens,
  findDuplicateReasons,
  validateDistinctFacilityReview,
} from './facility-duplicate-policy';

describe('Facility duplicate review policy', () => {
  const facility = {
    name: 'Phòng khám Minh An - Chi nhánh Quận 3',
    address: {
      street: '12 Nguyễn Đình Chiểu',
      district: 'Quận 3',
      province: 'Thành phố Hồ Chí Minh',
      provinceCode: 'HCMC' as const,
      country: 'VN' as const,
    },
    location: {
      type: 'Point' as const,
      coordinates: [106.686, 10.782] as [number, number],
    },
  };

  it('normalizes Vietnamese text for indexed lookup without losing branch tokens', () => {
    expect(facilityDuplicateSearchTokens(facility)).toEqual(
      expect.arrayContaining(['minh', 'an', 'nguyen', 'dinh', 'chieu']),
    );
    expect(
      facilityDuplicateSearchTokens({ name: 'Phòng khám Minh An chi nhánh 2' }),
    ).toContain('2');
    expect(facilityDuplicateSearchTokens(facility)).not.toContain('quan');
  });

  it('suggests a duplicate when name and address are similar', () => {
    expect(
      findDuplicateReasons(facility, {
        name: 'Phong kham Minh An chi nhanh Quan 3',
        address: '12 Nguyen Dinh Chieu, Quan 3',
      }),
    ).toEqual(expect.arrayContaining(['similar_name', 'similar_address']));
  });

  it('does not decide based on name, address, or proximity alone', () => {
    expect(
      findDuplicateReasons(facility, {
        name: facility.name,
        address: '99 Lê Lợi, Quận 1',
      }),
    ).toEqual([]);
    expect(
      findDuplicateReasons(facility, {
        name: 'Bệnh viện khác',
        location: facility.location,
      }),
    ).toEqual([]);
  });

  it('does not confuse different brand names or branches in different districts', () => {
    expect(
      findDuplicateReasons(
        {
          name: 'Phòng khám Minh An',
          address: {
            district: 'Quận 3',
            province: 'Thành phố Hồ Chí Minh',
            provinceCode: 'HCMC',
            country: 'VN',
          },
          location: { longitude: 106.68, latitude: 10.78 },
        },
        {
          name: 'Phòng khám Bình An',
          address: {
            district: 'Quận 7',
            province: 'Thành phố Hồ Chí Minh',
            provinceCode: 'HCMC',
            country: 'VN',
          },
          location: { longitude: 106.72, latitude: 10.72 },
        },
      ),
    ).toEqual([]);
    expect(
      findDuplicateReasons(
        {
          name: 'Phòng khám Minh An chi nhánh 2',
          address: {
            street: '12 Nguyễn Đình Chiểu',
            district: 'Quận 3',
            province: 'Thành phố Hồ Chí Minh',
            provinceCode: 'HCMC',
            country: 'VN',
          },
        },
        {
          name: 'Phòng khám Minh An chi nhánh 3',
          address: {
            street: '99 Lê Lợi',
            district: 'Quận 1',
            province: 'Thành phố Hồ Chí Minh',
            provinceCode: 'HCMC',
            country: 'VN',
          },
        },
      ),
    ).toEqual([]);
  });

  it('uses 100 meters only as a second signal with similar names', () => {
    expect(
      findDuplicateReasons(facility, {
        name: 'Phòng khám Minh An - Chi nhánh Quận 3',
        location: { longitude: 106.6865, latitude: 10.782 },
      }),
    ).toContain('nearby_location');
  });

  it('validates an explicit distinct-facility decision', () => {
    expect(
      validateDistinctFacilityReview({
        confirmedDistinct: true,
        reason: 'Hai phòng khám ở hai tầng khác nhau.',
        reviewedFacilityIds: ['507f1f77bcf86cd799439011'],
      }),
    ).toMatchObject({ confirmedDistinct: true });
    expect(() =>
      validateDistinctFacilityReview({
        confirmedDistinct: true,
        reason: 'Khác',
        reviewedFacilityIds: ['507f1f77bcf86cd799439011'],
      }),
    ).toThrow('FACILITY_DUPLICATE_REVIEW_INVALID');
  });
});
