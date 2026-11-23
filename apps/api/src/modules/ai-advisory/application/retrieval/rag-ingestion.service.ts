// ########################################
// orchestrator
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  IngestInputType,
  IngestOutputType,
  IRagIngestionService,
} from './ingestion.port';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from '../../infrastructure/retrieval/google-embedding.service';
import { AtlasVectorStoreService } from '../../infrastructure/retrieval/atlas-vector-store.service';

@Injectable()
export class RagIngestionService implements IRagIngestionService {
  private readonly logger = new Logger(RagIngestionService.name);

  constructor(
    private readonly chunkingService: ChunkingService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStoreService: AtlasVectorStoreService,
  ) {}

  async handleRAG(input: IngestInputType): Promise<IngestOutputType> {
    this.logger.log({
      event: 'knowledge.ingestion.started',
      documentId: input.documentId,
    });
    const contentHash = String(input.metadata?.contentHash ?? '');
    if (!contentHash)
      throw new BadRequestException(
        'Knowledge document content hash is required',
      );

    // chunking
    const chunks = await this.chunkingService.splitFile(input.file, {
      fileName: input.file.originalname,
      metadata: {
        documentId: input.documentId,
        ...(input.metadata ?? {}),
      },
    });

    this.logger.log({
      event: 'knowledge.ingestion.chunked',
      documentId: input.documentId,
      chunkCount: chunks.length,
    });

    // embedding, returning vector number[][]
    const textsForEmbedding = chunks
      .map((chunk) => chunk.content.trim())
      .filter(Boolean);

    if (textsForEmbedding.length === 0) {
      throw new BadRequestException('No valid chunk content for embedding');
    }

    const vectors =
      await this.embeddingService.generateEmbeddings(textsForEmbedding);

    this.logger.log({
      event: 'knowledge.ingestion.embedded',
      documentId: input.documentId,
      vectorCount: vectors.length,
    });

    if (vectors.length !== textsForEmbedding.length) {
      throw new BadRequestException(
        'Embedding output count does not match chunk count',
      );
    }

    // upsert to vector store
    const upsertResult = await this.vectorStoreService.upsertDocumentChunks({
      documentId: input.documentId,
      chunks,
      vectors,
      documentVersion: Number(input.metadata?.documentVersion ?? 1),
      contentHash,
      language: String(input.metadata?.language ?? 'vi'),
      scope: String(input.metadata?.scope ?? 'general'),
    });

    const embeddingDimension = upsertResult.embeddingDimension;

    this.logger.log({
      event: 'knowledge.ingestion.completed',
      documentId: input.documentId,
      chunkCount: chunks.length,
      embeddingDimension: embeddingDimension ?? 0,
    });

    return {
      documentId: input.documentId,
      chunks,
      embeddingDimension,
      inserted: upsertResult.inserted,
    };
  }
}
