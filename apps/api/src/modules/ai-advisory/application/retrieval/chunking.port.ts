export type ChunkSourceType =
  | 'txt'
  | 'doc'
  | 'docx'
  | 'pdf'
  | 'html'
  | 'unknown';

export type ChunkMetadata = Record<string, unknown> & {
  sourceType?: ChunkSourceType;
  fileName?: string;
  pageNumber?: number;
  sectionTitle?: string;
};

export interface ChunkPayload {
  chunkIndex: number;
  content: string;
  metadata: ChunkMetadata;
}

export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  minChunkSize?: number;
  sourceType?: ChunkSourceType;
  fileName?: string;
  metadata?: ChunkMetadata;
}

export interface IChunkingService {
  splitText(text: string, options?: ChunkingOptions): Promise<ChunkPayload[]>;
}
