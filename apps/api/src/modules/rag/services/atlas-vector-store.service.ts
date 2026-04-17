import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AiDocumentChunk,
  AiDocumentChunkDocument,
} from '../../ai-document-chunks/entities/ai-document-chunk.entity';
import { EmbeddingService } from './google-embedding.service';
import {
  IVectorStoreService,
  UpsertChunksInput,
  UpsertChunksResult,
  VectorSearchResult,
} from '../interfaces/vector-store.interface';

@Injectable()
export class AtlasVectorStoreService implements IVectorStoreService {
  private readonly logger = new Logger(AtlasVectorStoreService.name);
  private readonly vectorIndexName = 'vector_index';

  constructor(
    @InjectModel(AiDocumentChunk.name)
    private readonly aiDocumentChunkModel: Model<AiDocumentChunkDocument>,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async upsertDocumentChunks(
    input: UpsertChunksInput,
  ): Promise<UpsertChunksResult> {
    if (!Types.ObjectId.isValid(input.documentId)) {
      throw new BadRequestException('Invalid documentId for vector upsert');
    }

    const validChunks = input.chunks.filter((chunk) => chunk.content?.trim());
    if (validChunks.length === 0) {
      throw new BadRequestException('No valid chunks to upsert');
    }

    if (input.vectors.length !== validChunks.length) {
      throw new BadRequestException(
        'Vectors count does not match chunks count for upsert',
      );
    }

    const documentObjectId = new Types.ObjectId(input.documentId);

    await this.aiDocumentChunkModel.deleteMany({
      documentId: documentObjectId,
    });

    const payload = validChunks.map((chunk, index) => ({
      documentId: documentObjectId,
      chunkIndex: chunk.chunkIndex ?? index,
      content: chunk.content,
      embedding: input.vectors[index],
      isActive: true,
    }));

    const inserted = await this.aiDocumentChunkModel.insertMany(payload, {
      ordered: true,
    });

    const embeddingDimension = input.vectors[0]?.length ?? null;
    this.logger.log(
      `Vector chunks upserted: documentId=${input.documentId}, inserted=${inserted.length}, dim=${embeddingDimension ?? 0}`,
    );

    return {
      inserted: inserted.length,
      embeddingDimension,
    };
  }

  async similaritySearchByText(
    query: string,
    limit = 3,
  ): Promise<VectorSearchResult[]> {
    const normalizedLimit = Math.max(1, Math.min(20, limit));
    const queryVector =
      await this.embeddingService.generateQueryEmbedding(query);

    const pipeline = [
      {
        $vectorSearch: {
          index: this.vectorIndexName,
          path: 'embedding',
          queryVector,
          numCandidates: Math.max(50, normalizedLimit * 20),
          limit: normalizedLimit,
          filter: { isActive: true },
        },
      },
      {
        $project: {
          _id: 1,
          documentId: 1,
          content: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ];

    const results = await this.aiDocumentChunkModel.aggregate<{
      _id: Types.ObjectId;
      documentId: Types.ObjectId;
      content: string;
      score: number;
    }>(pipeline);

    return results.map((item) => ({
      chunkId: item._id.toString(),
      documentId: item.documentId.toString(),
      content: item.content,
      score: item.score,
    }));
  }
}
