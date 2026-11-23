import { ChunkPayload } from './chunking.port';
import { ExtractableFile } from './text-extraction.port';

export type IngestInputType = {
  documentId: string;
  file: ExtractableFile;
  metadata?: Record<string, unknown>;
};

export type IngestOutputType = {
  documentId: string;
  chunks: ChunkPayload[];
  embeddingDimension: number | null;
  inserted: number;
};

export interface IRagIngestionService {
  handleRAG(input: IngestInputType): Promise<IngestOutputType>;
}
