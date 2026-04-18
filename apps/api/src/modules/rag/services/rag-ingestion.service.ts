// orchestrator
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  IngestInputType,
  IngestOutputType,
  IRagIngestionService,
} from '../interfaces/ingestion.interface';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from './google-embedding.service';
import { AtlasVectorStoreService } from './atlas-vector-store.service';

@Injectable()
export class RagIngestionService implements IRagIngestionService {
  private readonly logger = new Logger(RagIngestionService.name);

  constructor(
    private readonly chunkingService: ChunkingService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStoreService: AtlasVectorStoreService,
  ) {}

  async handleRAG(input: IngestInputType): Promise<IngestOutputType> {
    this.logger.log(
      `RAG start: documentId=${input.documentId}, file=${input.file.originalname}`,
    );

    // chunking
    const chunks = await this.chunkingService.splitFile(input.file, {
      fileName: input.file.originalname,
      metadata: {
        documentId: input.documentId,
        ...(input.metadata ?? {}),
      },
    });

    this.logger.log(
      `RAG chunking done: documentId=${input.documentId}, chunks=${chunks.length}`,
    );

    // embedding, returning vector number[][]
    const textsForEmbedding = chunks
      .map((chunk) => chunk.content.trim())
      .filter(Boolean);

    if (textsForEmbedding.length === 0) {
      throw new BadRequestException('No valid chunk content for embedding');
    }

    const vectors =
      await this.embeddingService.generateEmbeddings(textsForEmbedding);

    this.logger.log(
      `RAG embedding done: documentId=${input.documentId}, vectors=${vectors.length}`,
    );

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
    });

    const embeddingDimension = upsertResult.embeddingDimension;

    this.logger.log(
      `RAG ingestion complete: chunks=${chunks.length}, vectors=${vectors.length}, dimension=${embeddingDimension ?? 0}`,
    );

    return {
      documentId: input.documentId,
      chunks,
      embeddingDimension,
      inserted: upsertResult.inserted,
    };
  }
}
