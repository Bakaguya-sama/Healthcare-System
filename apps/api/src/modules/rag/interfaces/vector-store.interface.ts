import { ChunkPayload } from './chunking.interface';

export type UpsertChunksInput = {
  documentId: string;
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
};

export interface IVectorStoreService {
  upsertDocumentChunks(input: UpsertChunksInput): Promise<UpsertChunksResult>;
  similaritySearchByText(
    query: string,
    limit?: number,
  ): Promise<VectorSearchResult[]>;
}

/** Application-owned port; the Atlas implementation is an infrastructure adapter. */
export const VECTOR_SEARCH_PORT = Symbol('VECTOR_SEARCH_PORT');
