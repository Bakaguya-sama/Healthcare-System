import { Injectable, Logger } from '@nestjs/common';
import {
  IRagRetrievalService,
  RetrievalOutput,
  RetrievalQueryInput,
} from '../interfaces/retrieval.interface';
import { AtlasVectorStoreService } from './atlas-vector-store.service';

@Injectable()
export class RagRetrievalService implements IRagRetrievalService {
  private readonly logger = new Logger(RagRetrievalService.name);
  private readonly defaultLimit = 3;
  private readonly maxLimit = 10;
  private readonly defaultThreshold = 0.85;

  constructor(private readonly vectorStoreService: AtlasVectorStoreService) {}

  async retrieve(input: RetrievalQueryInput): Promise<RetrievalOutput> {
    const query = input.query?.trim() ?? '';
    if (!query) {
      return {
        query,
        threshold: input.minScore ?? this.defaultThreshold,
        hits: [],
      };
    }

    const limit = this.normalizeLimit(input.limit);
    const threshold = this.normalizeThreshold(input.minScore);

    const rawHits = await this.vectorStoreService.similaritySearchByText(
      query,
      limit,
    );

    const filteredHits = rawHits.filter((hit) => hit.score >= threshold);
    const dedupedHits = this.deduplicateByContent(filteredHits);

    this.logger.log(
      `RAG retrieve: query="${query}", threshold=${threshold.toFixed(2)}, kept=${dedupedHits.length}/${rawHits.length}`,
    );

    return {
      query,
      threshold,
      hits: dedupedHits,
    };
  }

  private normalizeLimit(limit?: number): number {
    if (typeof limit !== 'number' || Number.isNaN(limit)) {
      return this.defaultLimit;
    }

    return Math.max(1, Math.min(this.maxLimit, Math.floor(limit)));
  }

  private normalizeThreshold(minScore?: number): number {
    if (typeof minScore !== 'number' || Number.isNaN(minScore)) {
      return this.defaultThreshold;
    }

    return Math.max(0, Math.min(1, minScore));
  }

  private deduplicateByContent(
    hits: RetrievalOutput['hits'],
  ): RetrievalOutput['hits'] {
    const seen = new Set<string>();
    const deduped: RetrievalOutput['hits'] = [];

    for (const hit of hits) {
      const normalizedContent = hit.content
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

      if (!normalizedContent || seen.has(normalizedContent)) {
        continue;
      }

      seen.add(normalizedContent);
      deduped.push(hit);
    }

    return deduped;
  }
}
