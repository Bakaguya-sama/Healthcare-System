import { ChunkPayload } from './chunking.interface';
import { ExtractableFile } from './text-extraction.interface';

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
