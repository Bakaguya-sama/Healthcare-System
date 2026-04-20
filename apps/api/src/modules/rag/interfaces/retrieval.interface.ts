import { VectorSearchResult } from './vector-store.interface';

export type RetrievalQueryInput = {
  query: string;
  limit?: number;
  minScore?: number;
};

export type RetrievalOutput = {
  query: string;
  threshold: number;
  hits: VectorSearchResult[];
};

export interface IRagRetrievalService {
  retrieve(input: RetrievalQueryInput): Promise<RetrievalOutput>;
}
