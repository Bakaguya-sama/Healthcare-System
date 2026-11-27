import { ConfigService } from '@nestjs/config';
import { SearchMedicalFacilities } from './search-medical-facilities.use-case';
import type { CareDirectoryProgramCatalog, CareDirectoryQueryRepository } from '../ports/care-directory.ports';

describe('SearchMedicalFacilities', () => {
  const specialty = { code: 'cardiology', nameVi: 'Tim mạch', synonyms: [], status: 'active' as const, revision: 1 };
  const page = { items: [], pagination: { page: 1, limit: 20, total: 0, hasNextPage: false } };
  const directory = {
    getActiveSpecialty: jest.fn().mockResolvedValue(specialty),
    findPublishedMapping: jest.fn().mockResolvedValue(null),
    searchVerifiedFacilities: jest.fn().mockResolvedValue(page),
  } as unknown as jest.Mocked<CareDirectoryQueryRepository>;
  const programs = {
    findPublishedProgram: jest.fn().mockResolvedValue({ programCode: 'cc-program', diseaseKey: 'hypertension' }),
    hasPublishedProgramForDisease: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<CareDirectoryProgramCatalog>;
  const config = { get: jest.fn((key: string, fallback?: unknown) => key === 'FACILITY_DIRECTORY_ENABLED' ? true : fallback) } as unknown as ConfigService;
  let search: SearchMedicalFacilities;

  beforeEach(() => {
    jest.clearAllMocks();
    search = new SearchMedicalFacilities(directory, programs, config);
  });

  it('uses a published Program mapping first and accepts active patients regardless of plan', async () => {
    const programMapping = { id: 'mapping-1', scope: 'program' as const, scopeKey: 'cc-program', version: 1, revision: 1, status: 'published' as const, specialtyCodes: ['cardiology'], sourceReferences: ['https://example.org/source'] };
    directory.findPublishedMapping = jest.fn(async (_scope, key) => key === 'cc-program' ? programMapping : null);
    await search.execute('synthetic-patient', { programCode: ' cc-program ', area: ' Quận 1 ' });
    expect(directory.findPublishedMapping.mock.calls[0]).toEqual(['program', 'cc-program']);
    expect(directory.searchVerifiedFacilities.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ specialtyCodes: ['cardiology'], area: 'Quận 1', reasonCode: 'program_mapping' }));
  });

  it('returns manual specialty selection instead of guessing when no mapping is published', async () => {
    const result = await search.execute('synthetic-patient', { diseaseKey: 'hypertension', area: 'Quận 1' });
    expect(result).toEqual({ data: { mappingStatus: 'manual_specialty_required', mappingSource: null, items: [], pagination: { page: 1, limit: 20, total: 0, hasNextPage: false } } });
    expect(directory.searchVerifiedFacilities.mock.calls).toHaveLength(0);
  });

  it('requires explicit consent for precise location and a non-blank area otherwise', async () => {
    await expect(search.execute('synthetic-patient', { specialtyCode: 'cardiology', location: { longitude: 106.7, latitude: 10.7 } })).rejects.toThrow('Explicit location consent is required.');
    await expect(search.execute('synthetic-patient', { specialtyCode: 'cardiology', area: '   ' })).rejects.toThrow('FACILITY_AREA_INVALID');
    await expect(search.execute('synthetic-patient', { specialtyCode: 'cardiology', area: 'Quận 1', location: { longitude: 106.7, latitude: 10.7 }, locationConsent: true })).rejects.toThrow('Choose either an area or a precise location.');
    expect(directory.searchVerifiedFacilities.mock.calls).toHaveLength(0);
  });

  it('keeps internal directory disabled by default until its feature flag is enabled', async () => {
    const disabledSearch = new SearchMedicalFacilities(directory, programs, {
      get: (_key: string, fallback?: unknown) => fallback,
    } as ConfigService);

    await expect(disabledSearch.execute('synthetic-patient', { specialtyCode: 'cardiology', area: 'Quận 1' }))
      .rejects.toMatchObject({ status: 503 });
    expect(directory.searchVerifiedFacilities.mock.calls).toHaveLength(0);
  });
});
