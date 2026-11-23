import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AiDocumentChunk,
  AiDocumentChunkDocument,
} from '../../../domain/entities/knowledge-base/chunks/ai-document-chunk.entity';
import { EmbeddingService } from './google-embedding.service';
import {
  IVectorStoreService,
  UpsertChunksInput,
  UpsertChunksResult,
  VectorSearchResult,
} from '../../../application/ports/retrieval/vector-store.port';

@Injectable()
export class AtlasVectorStoreService implements IVectorStoreService {
  private readonly logger = new Logger(AtlasVectorStoreService.name);
  private readonly vectorIndexName = 'vector_index';
  private readonly fullTextIndexName = 'ai_document_chunks_fulltext';

  constructor(
    @InjectModel(AiDocumentChunk.name)
    private readonly aiDocumentChunkModel: Model<AiDocumentChunkDocument>,
    private readonly embeddingService: EmbeddingService,
    @Optional() private readonly config?: ConfigService,
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

    const invalidVectorIndex = input.vectors.findIndex(
      (vector) =>
        !Array.isArray(vector) ||
        vector.length === 0 ||
        vector.some(
          (value) => typeof value !== 'number' || Number.isNaN(value),
        ),
    );

    if (invalidVectorIndex !== -1) {
      throw new BadRequestException(
        `Invalid embedding vector at index ${invalidVectorIndex}`,
      );
    }

    const documentObjectId = new Types.ObjectId(input.documentId);

    await this.aiDocumentChunkModel.deleteMany({
      documentId: documentObjectId,
    });

    const payload = validChunks.map((chunk, index) => ({
      documentId: documentObjectId,
      documentVersion: input.documentVersion,
      contentHash: input.contentHash,
      knowledgeLanguage: input.language,
      scope: input.scope,
      chunkIndex: chunk.chunkIndex ?? index,
      content: chunk.content,
      embedding: input.vectors[index],
      isActive: true,
      pageNumber: chunk.metadata.pageNumber ?? null,
      sectionTitle: chunk.metadata.sectionTitle ?? null,
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

  // Vector search
  async similaritySearchByText(
    query: string,
    limit = 3,
    scope = 'general',
    language = 'vi',
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
          filter: {
            isActive: true,
            reviewStatus: 'approved',
            scope,
            knowledgeLanguage: language,
          },
        },
      },
      {
        $project: {
          _id: 1,
          documentId: 1,
          content: 1,
          score: { $meta: 'vectorSearchScore' },
          documentVersion: 1,
          pageNumber: 1,
          sectionTitle: 1,
        },
      },
      {
        $lookup: {
          from: 'aidocuments',
          localField: 'documentId',
          foreignField: '_id',
          as: 'document',
        },
      },
      { $unwind: '$document' },
      {
        $match: {
          'document.reviewStatus': 'approved',
          'document.status': 'active',
          'document.scope': scope,
          'document.knowledgeLanguage': language,
          $or: [
            { 'document.validUntil': { $exists: false } },
            { 'document.validUntil': null },
            { 'document.validUntil': { $gt: new Date() } },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          documentId: 1,
          content: 1,
          score: 1,
          documentVersion: 1,
          pageNumber: 1,
          sectionTitle: 1,
          title: '$document.title',
          source: '$document.source',
        },
      },
    ];

    const results = await this.aiDocumentChunkModel.aggregate<{
      _id: Types.ObjectId;
      documentId: Types.ObjectId;
      content: string;
      score: number;
      documentVersion: number;
      pageNumber?: number | null;
      sectionTitle?: string | null;
      title?: string;
      source?: string;
    }>(pipeline).option({ maxTimeMS: this.searchTimeoutMs() });

    return results.map((item) => ({
      chunkId: item._id.toString(),
      documentId: item.documentId.toString(),
      content: item.content,
      score: item.score,
      documentVersion: item.documentVersion,
      pageNumber: item.pageNumber,
      sectionTitle: item.sectionTitle,
      title: item.title,
      source: item.source,
    }));
  }

  /** Atlas text branch for hybrid retrieval. It preserves the same serving policy as vector search. */
  async fullTextSearchByText(
    query: string,
    limit = 3,
    scope = 'general',
    language = 'vi',
  ): Promise<VectorSearchResult[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];
    const now = new Date();
    const results = await this.aiDocumentChunkModel
      .aggregate<{
        _id: Types.ObjectId;
        documentId: Types.ObjectId;
        content: string;
        score: number;
        documentVersion: number;
        pageNumber?: number | null;
        sectionTitle?: string | null;
        title?: string;
        source?: string;
      }>([
        {
          $search: {
            index: this.fullTextIndexName,
            text: { query: normalizedQuery, path: 'content' },
          },
        },
        {
          $match: {
            isActive: true,
            reviewStatus: 'approved',
            scope,
            knowledgeLanguage: language,
            $or: [
              { validUntil: { $exists: false } },
              { validUntil: null },
              { validUntil: { $gt: now } },
            ],
          },
        },
        { $limit: Math.max(1, Math.min(20, limit)) },
        {
          $lookup: {
            from: 'aidocuments',
            localField: 'documentId',
            foreignField: '_id',
            as: 'document',
          },
        },
        { $unwind: '$document' },
        {
          $match: {
            'document.reviewStatus': 'approved',
            'document.status': 'active',
            'document.scope': scope,
            'document.knowledgeLanguage': language,
            $or: [
              { 'document.validUntil': { $exists: false } },
              { 'document.validUntil': null },
              { 'document.validUntil': { $gt: now } },
            ],
          },
        },
        {
          $project: {
            documentId: 1,
            content: 1,
            documentVersion: 1,
            pageNumber: 1,
            sectionTitle: 1,
            score: { $meta: 'searchScore' },
            title: '$document.title',
            source: '$document.source',
          },
        },
      ])
      .option({ maxTimeMS: this.searchTimeoutMs() })
      .exec();
    return results.map((item) => ({
      chunkId: item._id.toString(),
      documentId: item.documentId.toString(),
      content: item.content,
      score: item.score,
      documentVersion: item.documentVersion,
      pageNumber: item.pageNumber,
      sectionTitle: item.sectionTitle,
      title: item.title,
      source: item.source,
    }));
  }

  private searchTimeoutMs(): number {
    const configured = this.config?.get<number>('RAG_ATLAS_SEARCH_TIMEOUT_MS');
    return Math.max(1_000, Math.min(15_000, configured ?? 5_000));
  }
}
