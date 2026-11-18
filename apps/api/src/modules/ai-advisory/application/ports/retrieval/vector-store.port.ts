import { ChunkPayload } from './chunking.port';

export type UpsertChunksInput = {
  documentId: string;
  documentVersion: number;
  contentHash: string;
  language: string;
  scope: string;
  chunks: ChunkPayload[];
  vectors: number[][];
};

export type UpsertChunksResult = {
  inserted: number;
  embeddingDimension: number | null;
};

export type VectorSearchResult = {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  documentVersion: number;
  pageNumber?: number | null;
  sectionTitle?: string | null;
  source?: string;
  title?: string;
};

export interface IVectorStoreService {
  upsertDocumentChunks(input: UpsertChunksInput): Promise<UpsertChunksResult>;
  similaritySearchByText(
    query: string,
    limit?: number,
    scope?: string,
    language?: string,
  ): Promise<VectorSearchResult[]>;
}

/** Application-owned port; the Atlas implementation is an infrastructure adapter. */
export const VECTOR_SEARCH_PORT = Symbol('VECTOR_SEARCH_PORT');
