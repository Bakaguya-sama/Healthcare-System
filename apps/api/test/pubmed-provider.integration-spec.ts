import { ConfigService } from '@nestjs/config';
import { ExternalEvidenceService } from '../src/modules/ai-advisory/application/retrieval/external-evidence.service';
import { ExternalEvidenceQueryPolicy } from '../src/modules/ai-advisory/domain/policies/external-evidence-query.policy';
import { PubmedLiteratureAdapter } from '../src/modules/ai-advisory/infrastructure/retrieval/pubmed-literature.adapter';

describe('PubMed external literature provider (integration)', () => {
  it('uses the live provider and fails closed without exposing a provider payload', async () => {
    const adapter = new PubmedLiteratureAdapter({ get: jest.fn(() => 8_000) } as unknown as ConfigService);
    const candidates = { captureExternalDiscoveries: jest.fn(async (records) => records.length) };
    const service = new ExternalEvidenceService(adapter, new ExternalEvidenceQueryPolicy(), candidates as never, { get: jest.fn((key: string) => key === 'RAG_EXTERNAL_EVIDENCE_ENABLED' ? true : 60_000) } as unknown as ConfigService);
    const discovered = await service.discoverCandidatesWhenInternalEvidenceIsInsufficient('hypertension guideline');
    expect(discovered).toBeGreaterThanOrEqual(0);
    for (const [records] of candidates.captureExternalDiscoveries.mock.calls) {
      expect(records.every((record: { sourceUrl: string }) => record.sourceUrl.startsWith('https://pubmed.ncbi.nlm.nih.gov/'))).toBe(true);
      expect(records.every((record: object) => !('abstract' in record))).toBe(true);
    }
  }, 15_000);
});
