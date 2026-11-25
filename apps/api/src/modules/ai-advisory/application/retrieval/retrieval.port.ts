import { VectorSearchResult } from './vector-store.port';

export type RetrievalQueryInput = {
  query: string;
  limit?: number;
  minScore?: number;
  scope?: string;
  language?: string;
};

export type RetrievalOutput = {
  query: string;
  threshold: number;
  hits: VectorSearchResult[];
};

export interface IRagRetrievalService {
  retrieve(input: RetrievalQueryInput): Promise<RetrievalOutput>;
}
