import { ExternalEvidenceQueryPolicy } from '../../domain/policies/external-evidence-query.policy';
import { ExternalEvidenceService } from './external-evidence.service';

describe('ExternalEvidenceService privacy boundary', () => {
  const provider = { searchMedicalLiterature: jest.fn() };
  const candidates = { captureExternalDiscoveries: jest.fn(async () => 1) };
  const config = {
    get: jest.fn((key: string) =>
      key === 'RAG_EXTERNAL_EVIDENCE_ENABLED' ? 'true' : undefined,
    ),
  };
  beforeEach(() => jest.clearAllMocks());
  it('never calls PubMed for identity or patient-history input', async () => {
    const service = new ExternalEvidenceService(
      provider,
      new ExternalEvidenceQueryPolicy(),
      candidates as never,
      config as never,
    );
    await expect(
      service.discoverCandidatesWhenInternalEvidenceIsInsufficient(
        'Tôi bị đau ngực, email huy@example.com, số 0912345678',
      ),
    ).resolves.toBe(0);
    expect(provider.searchMedicalLiterature).not.toHaveBeenCalled();
    expect(candidates.captureExternalDiscoveries).not.toHaveBeenCalled();
  });
  it('uses only scrubbed query and caches a safe external response', async () => {
    provider.searchMedicalLiterature.mockResolvedValue([
      {
        pmid: '1',
        title: 'Hypertension review',
        sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/1/',
      },
    ]);
    const service = new ExternalEvidenceService(
      provider,
      new ExternalEvidenceQueryPolicy(),
      candidates as never,
      config as never,
    );
    await service.discoverCandidatesWhenInternalEvidenceIsInsufficient(
      'Điều trị tăng huyết áp theo hướng dẫn mới',
    );
    await service.discoverCandidatesWhenInternalEvidenceIsInsufficient(
      'Điều trị tăng huyết áp theo hướng dẫn mới',
    );
    expect(provider.searchMedicalLiterature).toHaveBeenCalledTimes(1);
    expect(provider.searchMedicalLiterature).toHaveBeenCalledWith(
      expect.not.stringMatching(/@|0912/),
      3,
    );
    expect(candidates.captureExternalDiscoveries).toHaveBeenCalledTimes(2);
    expect(candidates.captureExternalDiscoveries).toHaveBeenCalledWith(
      [expect.objectContaining({ pmid: '1', title: 'Hypertension review' })],
    );
  });
  it('fails closed when the provider is rate-limited or unavailable', async () => {
    provider.searchMedicalLiterature.mockRejectedValueOnce(
      new Error('rate limited'),
    );
    const service = new ExternalEvidenceService(
      provider,
      new ExternalEvidenceQueryPolicy(),
      candidates as never,
      config as never,
    );
    await expect(
      service.discoverCandidatesWhenInternalEvidenceIsInsufficient(
        'Tổng quan bệnh tăng huyết áp',
      ),
    ).resolves.toBe(0);
  });
});
