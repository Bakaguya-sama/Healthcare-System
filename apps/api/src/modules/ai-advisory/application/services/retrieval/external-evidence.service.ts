import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EXTERNAL_LITERATURE_PORT,
  type ExternalLiteraturePort,
  type ExternalLiteratureRecord,
} from '../../ports/retrieval/external-literature.port';
import { ExternalEvidenceQueryPolicy } from '../../../domain/policies/external-evidence-query.policy';
import { KnowledgeCandidatesService } from '../knowledge-base/candidates/knowledge-candidates.service';

@Injectable()
export class ExternalEvidenceService {
  private readonly logger = new Logger(ExternalEvidenceService.name);
  private readonly cache = new Map<
    string,
    { expiresAt: number; records: ExternalLiteratureRecord[] }
  >();
  constructor(
    @Inject(EXTERNAL_LITERATURE_PORT)
    private readonly literature: ExternalLiteraturePort,
    private readonly policy: ExternalEvidenceQueryPolicy,
    private readonly candidates: KnowledgeCandidatesService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async discoverCandidatesWhenInternalEvidenceIsInsufficient(
    message: string,
    needsRecentLiterature = false,
  ): Promise<number> {
    if (
      !this.flag('RAG_EXTERNAL_EVIDENCE_ENABLED', false) &&
      !needsRecentLiterature
    )
      return 0;
    const query = this.policy.scrub(message);
    if (!query) {
      this.logger.warn({
        event: 'external_evidence.blocked',
        reason: 'unsafe_query',
      });
      return 0;
    }
    const cached = this.cache.get(query);
    if (cached && cached.expiresAt > Date.now())
      return this.candidates.captureExternalDiscoveries(cached.records);
    try {
      const records = await this.literature.searchMedicalLiterature(query, 3);
      this.cache.set(query, {
        records,
        expiresAt:
          Date.now() +
          (this.config?.get<number>('PUBMED_CACHE_TTL_MS') ?? 3_600_000),
      });
      this.logger.log({
        event: 'external_evidence.completed',
        recordCount: records.length,
      });
      return this.candidates.captureExternalDiscoveries(records);
    } catch (error) {
      this.logger.warn({
        event: 'external_evidence.unavailable',
        error: error instanceof Error ? error.name : 'unknown',
      });
      return 0;
    }
  }
  private flag(name: string, fallback: boolean): boolean {
    const value = this.config?.get<string | boolean>(name);
    return value === undefined ? fallback : value === true || value === 'true';
  }
}
