import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type CareDirectoryQueryRepository,
  type FacilityAdminAuthority,
  type MapProvider,
  type MedicalFacilityRepository,
} from '../ports/care-directory.ports';
import { SearchMapFacilityCandidates } from './search-map-facility-candidates.use-case';

describe('SearchMapFacilityCandidates', () => {
  const directory = {
    getActiveSpecialty: jest.fn(),
  } as unknown as jest.Mocked<CareDirectoryQueryRepository>;
  const admins = {
    isSuperAdmin: jest.fn(),
  } as unknown as jest.Mocked<FacilityAdminAuthority>;
  const maps = {
    search: jest.fn(),
  } as unknown as jest.Mocked<MapProvider>;
  const facilities = {} as jest.Mocked<MedicalFacilityRepository>;
  const config = {
    get: jest.fn((_key: string, fallback?: unknown) =>
      _key === 'GOOGLE_MAPS_PLACES_ENABLED' ? true : fallback,
    ),
  } as unknown as ConfigService;

  let useCase: SearchMapFacilityCandidates;

  beforeEach(() => {
    jest.clearAllMocks();
    admins.isSuperAdmin.mockResolvedValue(true);
    directory.getActiveSpecialty.mockResolvedValue({
      code: 'cardiology',
      nameVi: 'Tim mạch',
      status: 'active',
      revision: 1,
      synonyms: [],
    });
    maps.search.mockResolvedValue([
      {
        placeId: 'synthetic-place-1',
        name: 'Synthetic Clinic',
        attribution: 'Google Maps',
      },
    ]);
    useCase = new SearchMapFacilityCandidates(
      directory,
      admins,
      maps,
      facilities,
      config,
    );
  });

  it('keeps Patient external search on its existing specialty contract', async () => {
    const result = await useCase.forPatient('synthetic-patient', {
      specialtyCode: 'cardiology',
      area: 'Quận 3',
    });

    expect(directory.getActiveSpecialty).toHaveBeenCalledWith('cardiology');
    expect(maps.search).toHaveBeenCalledWith({
      actorId: 'synthetic-patient',
      specialtyName: 'Tim mạch',
      area: 'Quận 3',
      location: undefined,
      radiusKm: 10,
      placeType: undefined,
    });
    expect(result.data).toMatchObject({
      source: 'google_maps',
      verifiedInternally: false,
      items: [{ placeId: 'synthetic-place-1' }],
    });
  });

  it('requires Patient location consent before calling Google', async () => {
    await expect(
      useCase.forPatient('synthetic-patient', {
        specialtyCode: 'cardiology',
        location: { latitude: 10.77, longitude: 106.69 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(maps.search).not.toHaveBeenCalled();
  });

  it('uses the active internal specialty for Admin specialty search', async () => {
    await useCase.forSuperAdmin('synthetic-admin', {
      specialtyCode: 'cardiology',
      area: 'Quận 1',
    });

    expect(admins.isSuperAdmin).toHaveBeenCalledWith('synthetic-admin');
    expect(maps.search).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'synthetic-admin',
        specialtyName: 'Tim mạch',
        area: 'Quận 1',
      }),
    );
  });

  it('rejects mappable selector errors before contacting Google', async () => {
    await expect(
      useCase.forSuperAdmin('synthetic-admin', {
        query: 'Phòng khám A',
        specialtyCode: 'cardiology',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      useCase.forSuperAdmin('synthetic-admin', {
        query: ' ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(maps.search).not.toHaveBeenCalled();
  });
});
