import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChunkingService } from './services/chunking.service';
import { RagIngestionService } from './services/rag-ingestion.service';
import { TextExtractionService } from './services/text-extraction.service';
import { EmbeddingService } from './services/google-embedding.service';
import { AtlasVectorStoreService } from './services/atlas-vector-store.service';
import { RagRetrievalService } from './services/rag-retrieval.service';
import { ContextBuilderService } from './services/context-builder.service';
import { VECTOR_SEARCH_PORT } from './interfaces/vector-store.interface';
import {
  AiDocumentChunk,
  AiDocumentChunkSchema,
} from '../ai-document-chunks/entities/ai-document-chunk.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiDocumentChunk.name, schema: AiDocumentChunkSchema },
    ]),
  ],
  providers: [
    ChunkingService,
    TextExtractionService,
    RagIngestionService,
    RagRetrievalService,
    ContextBuilderService,
    EmbeddingService,
    AtlasVectorStoreService,
    { provide: VECTOR_SEARCH_PORT, useExisting: AtlasVectorStoreService },
  ],
  exports: [
    ChunkingService,
    TextExtractionService,
    RagIngestionService,
    RagRetrievalService,
    ContextBuilderService,
    EmbeddingService,
    AtlasVectorStoreService,
    VECTOR_SEARCH_PORT,
  ],
})
export class RagModule {}
