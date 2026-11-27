import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  FacilityAdminAuthority,
  MapProvider,
  MedicalFacilityRepository,
} from '../ports/care-directory.ports';
import { ManageMedicalFacilities } from './manage-medical-facilities.use-case';
import { FacilityDuplicateReviewRequiredError } from '../../domain/policies/facility-duplicate-policy';

describe('ManageMedicalFacilities authorization and freshness', () => {
  const facilities = {
    listAdminFacilities: jest.fn().mockResolvedValue({
      items: [
        {
          id: 'facility-1',
          status: 'verified',
          revision: 2,
          lastCheckedAt: '2026-05-01T00:00:00.000Z',
        },
      ],
      total: 1,
    }),
  } as unknown as jest.Mocked<MedicalFacilityRepository>;
  const admins = {
    isSuperAdmin: jest.fn(),
  } as unknown as jest.Mocked<FacilityAdminAuthority>;
  const maps = {} as never;
  const queries = {} as never;
  const config = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key === 'FACILITY_FRESHNESS_DAYS' ? 180 : fallback,
    ),
  } as unknown as ConfigService;

  beforeEach(() => jest.clearAllMocks());

  it('rejects an Admin who is not the canonical super_admin sub-role', async () => {
    admins.isSuperAdmin = jest.fn().mockResolvedValue(false);
    const useCase = new ManageMedicalFacilities(
      facilities,
      queries,
      admins,
      maps,
      config,
    );
    await expect(useCase.list('synthetic-admin', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(facilities.listAdminFacilities.mock.calls).toHaveLength(0);
  });

  it('filters recheck candidates and labels freshness from lastCheckedAt', async () => {
    admins.isSuperAdmin = jest.fn().mockResolvedValue(true);
    const useCase = new ManageMedicalFacilities(
      facilities,
      queries,
      admins,
      maps,
      config,
    );
    const result = await useCase.list('synthetic-super-admin', {
      needsRecheck: true,
      page: 1,
      limit: 20,
    });
    expect(facilities.listAdminFacilities.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        needsRecheck: true,
        staleBefore: expect.any(Date),
      }),
    );
    expect(result.data.items[0].needsRecheck).toBe(true);
  });

  it('returns an incomplete Place Details preview without inventing missing fields', async () => {
    const repository = {
      findCreateFacilityDraftFromPlaceReplay: jest.fn().mockResolvedValue(null),
      findFacilityByGooglePlaceId: jest.fn().mockResolvedValue(null),
      createFacilityDraftFromPlace: jest.fn().mockResolvedValue({
        id: 'synthetic-facility',
        status: 'draft',
        googlePlaceId: 'synthetic-place',
      }),
    } as unknown as jest.Mocked<MedicalFacilityRepository>;
    const authority = {
      isSuperAdmin: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<FacilityAdminAuthority>;
    const provider = {
      findPlace: jest.fn().mockResolvedValue({
        placeId: 'synthetic-place',
        attribution: 'Google Maps',
      }),
    } as unknown as jest.Mocked<MapProvider>;
    const useCase = new ManageMedicalFacilities(
      repository,
      {} as never,
      authority,
      provider,
      { get: () => true } as never,
    );

    const result = await useCase.createDraftFromMapCandidate(
      'synthetic-super-admin',
      'synthetic-place-details-key-01',
      'synthetic-place',
    );

    expect(
      result.data && 'providerPreview' in result.data
        ? result.data.providerPreview
        : undefined,
    ).toEqual({
      placeId: 'synthetic-place',
      attribution: 'Google Maps',
      source: 'google_maps',
      verifiedInternally: false,
    });
    expect(repository.createFacilityDraftFromPlace).toHaveBeenCalledWith({
      placeId: 'synthetic-place',
      providerPreview: {
        placeId: 'synthetic-place',
        attribution: 'Google Maps',
      },
      actorId: 'synthetic-super-admin',
      key: 'synthetic-place-details-key-01',
    });
  });

  it('returns the review candidates from the repository as a structured conflict', async () => {
    const repository = {
      createFacilityDraft: jest.fn().mockRejectedValue(
        new FacilityDuplicateReviewRequiredError([
          {
            id: '507f1f77bcf86cd799439011',
            status: 'verified',
            revision: 2,
            name: 'Phòng khám Minh An',
            reasonCodes: ['similar_name', 'similar_address'],
          },
        ], false),
      ),
    } as unknown as jest.Mocked<MedicalFacilityRepository>;
    const useCase = new ManageMedicalFacilities(
      repository,
      {} as never,
      { isSuperAdmin: async () => true },
      {} as never,
      { get: () => true } as never,
    );
    await expect(
      useCase.createDraft(
        'synthetic-super-admin',
        'synthetic-duplicate-create-key-01',
        { name: 'Phòng khám Minh An' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('links a Place ID only after checking replay, ownership, and provider identity', async () => {
    const repository = {
      findUpdateFacilityMetadataReplay: jest.fn().mockResolvedValue(null),
      getAdminFacility: jest.fn().mockResolvedValue({
        id: 'facility-1',
        status: 'verified',
        revision: 3,
      }),
      findFacilityByGooglePlaceId: jest.fn().mockResolvedValue(null),
      updateFacilityMetadata: jest.fn().mockResolvedValue({
        id: 'facility-1',
        status: 'verified',
        revision: 4,
        googlePlaceId: 'synthetic-place-1',
      }),
    } as unknown as jest.Mocked<MedicalFacilityRepository>;
    const authority = { isSuperAdmin: jest.fn().mockResolvedValue(true) };
    const provider = {
      findPlace: jest.fn().mockResolvedValue({
        placeId: 'synthetic-place-1',
        attribution: 'Google Maps',
      }),
    } as unknown as jest.Mocked<MapProvider>;
    const useCase = new ManageMedicalFacilities(
      repository,
      {} as never,
      authority,
      provider,
      { get: () => true } as never,
    );
    const result = await useCase.updateFacilityMetadata(
      'synthetic-super-admin',
      'synthetic-place-link-key-0001',
      'facility-1',
      { placeId: 'synthetic-place-1', expectedRevision: 3 },
    );
    expect(result.data).toMatchObject({ googlePlaceId: 'synthetic-place-1' });
    expect(
      repository.findUpdateFacilityMetadataReplay.mock.invocationCallOrder[0],
    ).toBeLessThan(provider.findPlace.mock.invocationCallOrder[0]);
    expect(repository.updateFacilityMetadata).toHaveBeenCalledWith({
      id: 'facility-1',
      placeId: 'synthetic-place-1',
      expectedRevision: 3,
      actorId: 'synthetic-super-admin',
      key: 'synthetic-place-link-key-0001',
    });
  });
});
