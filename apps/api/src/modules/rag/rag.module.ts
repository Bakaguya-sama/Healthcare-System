import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChunkingService } from './services/chunking.service';
import { RagIngestionService } from './services/rag-ingestion.service';
import { TextExtractionService } from './services/text-extraction.service';
import { EmbeddingService } from './services/google-embedding.service';
import { AtlasVectorStoreService } from './services/atlas-vector-store.service';
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
    EmbeddingService,
    AtlasVectorStoreService,
  ],
  exports: [
    ChunkingService,
    TextExtractionService,
    RagIngestionService,
    EmbeddingService,
    AtlasVectorStoreService,
  ],
})
export class RagModule {}
