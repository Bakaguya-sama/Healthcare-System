import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IRagRetrievalService,
  RetrievalOutput,
  RetrievalQueryInput,
} from '../../ports/retrieval/retrieval.port';
import { VECTOR_SEARCH_PORT } from '../../ports/retrieval/vector-store.port';
import type {
  IVectorStoreService,
  VectorSearchResult,
} from '../../ports/retrieval/vector-store.port';

/** Layer-1 evidence use case. RRF avoids mixing incomparable Atlas score scales. */
@Injectable()
export class RagRetrievalService implements IRagRetrievalService {
  private readonly logger = new Logger(RagRetrievalService.name);
  private readonly defaultLimit = 3;
  private readonly maxLimit = 10;
  private readonly rrfConstant = 60;

  constructor(
    @Inject(VECTOR_SEARCH_PORT)
    private readonly vectorStoreService: IVectorStoreService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async retrieve(input: RetrievalQueryInput): Promise<RetrievalOutput> {
    const query = input.query?.trim() ?? '';
    const threshold = this.resolveThreshold(input);
    if (!query) return { query, threshold, hits: [] };
    const limit = this.normalizeLimit(input.limit);
    const candidateLimit = Math.min(this.maxLimit * 2, Math.max(limit * 4, 8));
    const vectorSearch = this.searchSafely('vector', () =>
      this.vectorStoreService.similaritySearchByText(
        query,
        candidateLimit,
        input.scope,
        input.language,
      ),
    );
    const hybridEnabled = this.flag('RAG_HYBRID_RETRIEVAL_ENABLED', true);
    const textSearch =
      hybridEnabled &&
      typeof this.vectorStoreService.fullTextSearchByText === 'function'
        ? this.searchSafely('full_text', () =>
            this.vectorStoreService.fullTextSearchByText!(
              query,
              candidateLimit,
              input.scope,
              input.language,
            ),
          )
        : Promise.resolve([]);
    // The two Atlas branches do not depend on one another.  Run them in
    // parallel so hybrid retrieval is bounded by the slower branch, not their
    // combined latency; each branch still fails closed independently.
    const [vectorHits, textHits] = await Promise.all([vectorSearch, textSearch]);
    const rankedSource = textHits.length
      ? this.fuseByReciprocalRank(vectorHits, textHits)
      : vectorHits;
    const ranked = rankedSource.filter((hit) => hit.score >= threshold);
    const hits = this.flag('RAG_MMR_ENABLED', false)
      ? this.selectDiverseHits(ranked, limit)
      : this.removeDuplicateContent(ranked).slice(0, limit);
    this.logger.log({
      event: 'knowledge.retrieval.completed',
      mode: hybridEnabled ? 'hybrid_rrf' : 'vector',
      threshold,
      returnedCount: hits.length,
      vectorCandidateCount: vectorHits.length,
      textCandidateCount: textHits.length,
      scope: input.scope ?? 'general',
      language: input.language ?? 'vi',
    });
    return { query, threshold, hits };
  }

  /** Public to make the benchmark's ranking rule explicit and testable. */
  fuseByReciprocalRank(
    vectorHits: VectorSearchResult[],
    textHits: VectorSearchResult[],
  ): VectorSearchResult[] {
    const candidates = new Map<
      string,
      { hit: VectorSearchResult; score: number }
    >();
    for (const branch of [vectorHits, textHits]) {
      branch.forEach((hit, index) => {
        const prior = candidates.get(hit.chunkId);
        candidates.set(hit.chunkId, {
          hit: prior?.hit ?? hit,
          score: (prior?.score ?? 0) + 1 / (this.rrfConstant + index + 1),
        });
      });
    }
    // RRF scores are intentionally small (for example 1 / 61).  Use the
    // strongest actual candidate as the denominator; forcing a minimum of 1
    // makes every valid hybrid result fall below the evidence threshold.
    const maxScore = Math.max(
      ...[...candidates.values()].map((item) => item.score),
    );
    return [...candidates.values()]
      .map(({ hit, score }) => ({
        ...hit,
        score: Number((score / maxScore).toFixed(6)),
      }))
      .sort(
        (left, right) =>
          right.score - left.score || left.chunkId.localeCompare(right.chunkId),
      );
  }

  private selectDiverseHits(
    hits: VectorSearchResult[],
    limit: number,
  ): VectorSearchResult[] {
    const selected: VectorSearchResult[] = [];
    const seen = new Set<string>();
    for (const hit of hits) {
      const key = this.contentKey(hit.content);
      if (!key || seen.has(key)) continue;
      if (
        selected.some(
          (item) =>
            item.documentId === hit.documentId &&
            item.sectionTitle === hit.sectionTitle,
        )
      )
        continue;
      selected.push(hit);
      seen.add(key);
      if (selected.length === limit) break;
    }
    return selected;
  }

  private removeDuplicateContent(
    hits: VectorSearchResult[],
  ): VectorSearchResult[] {
    const seen = new Set<string>();
    return hits.filter((hit) => {
      const key = this.contentKey(hit.content);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private resolveThreshold(input: RetrievalQueryInput): number {
    if (typeof input.minScore === 'number')
      return this.normalizeThreshold(input.minScore);
    return this.normalizeThreshold(
      this.config?.get<number>('RAG_INTERNAL_EVIDENCE_THRESHOLD') ?? 0.6,
    );
  }
  private flag(name: string, fallback: boolean): boolean {
    const value = this.config?.get<string | boolean>(name);
    return value === undefined ? fallback : value === true || value === 'true';
  }
  private normalizeLimit(limit?: number): number {
    return typeof limit !== 'number' || Number.isNaN(limit)
      ? this.defaultLimit
      : Math.max(1, Math.min(this.maxLimit, Math.floor(limit)));
  }
  private normalizeThreshold(value?: number): number {
    return typeof value !== 'number' || Number.isNaN(value)
      ? 0.6
      : Math.max(0, Math.min(1, value));
  }
  private contentKey(content: string): string {
    return content.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private async searchSafely(
    branch: 'vector' | 'full_text',
    operation: () => Promise<VectorSearchResult[]>,
  ): Promise<VectorSearchResult[]> {
    try {
      return await operation();
    } catch (error: unknown) {
      this.logger.warn({
        event: 'knowledge.retrieval.branch_unavailable',
        branch,
        error: error instanceof Error ? error.name : 'unknown',
      });
      return [];
    }
  }
}
