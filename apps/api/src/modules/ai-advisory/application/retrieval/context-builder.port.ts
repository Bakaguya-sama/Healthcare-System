import { VectorSearchResult } from './vector-store.port';

export type ContextBuilderInput = {
  hits: VectorSearchResult[];
  tokenBudget?: number;
};

export type Citation = {
  source: string;
  chunkId: string;
  documentId: string;
  score: number;
  excerpt: string;
  documentVersion: number;
  pageNumber?: number | null;
  sectionTitle?: string | null;
  title?: string;
};

export type ContextBuilderOutput = {
  context: string | null;
  citations: Citation[];
  estimatedTokens: number;
};

export interface IContextBuilderService {
  build(input: ContextBuilderInput): ContextBuilderOutput;
}
