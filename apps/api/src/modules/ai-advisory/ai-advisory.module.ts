import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FilesModule } from '../../infrastructure/files/files.module';
import { HealthTrackingModule } from '../health-tracking/health-tracking.module';
import { ModerationModule } from '../moderation/moderation.module';
import { AiAssistantController } from './conversations/ai-assistant.controller';
import { AiAssistantService } from './conversations/ai-assistant.service';
import { AiConversationQueryService } from './conversations/ai-conversation-query.service';
import { AiConversationManagementService } from './conversations/ai-conversation-management.service';
import { AiMessageOrchestrationService } from './conversations/ai-message-orchestration.service';
import {
  AiConversationMessage,
  AiConversationMessageSchema,
} from './conversations/entities/ai-conversation-message.entity';
import {
  AiConversation,
  AiConversationSchema,
} from './conversations/entities/ai-conversation.entity';
import { AiResponseOrchestrator } from './conversations/services/ai-response-orchestrator.service';
import { AiSafetyService } from './conversations/services/ai-safety.service';
import { LlmGatewayService } from './conversations/services/llm-gateway.service';
import { MedicalAnsweringService } from './conversations/services/medical-answering.service';
import { PromptBuilderService } from './conversations/services/prompt-builder.service';
import { AiFeedbacksController } from './feedback/ai-feedbacks.controller';
import { AiFeedbacksService } from './feedback/ai-feedbacks.service';
import {
  AiFeedback,
  AiFeedbackSchema,
} from './feedback/entities/ai-feedback.entity';
import { AiDocumentChunksController } from './knowledge-base/chunks/ai-document-chunks.controller';
import { AiDocumentChunksService } from './knowledge-base/chunks/ai-document-chunks.service';
import {
  AiDocumentChunk,
  AiDocumentChunkSchema,
} from './knowledge-base/chunks/entities/ai-document-chunk.entity';
import { AiDocumentsController } from './knowledge-base/documents/ai-documents.controller';
import { AiDocumentsService } from './knowledge-base/documents/ai-documents.service';
import {
  AiDocument,
  AiDocumentSchema,
} from './knowledge-base/documents/entities/ai-document.entity';
import { VECTOR_SEARCH_PORT } from './retrieval/interfaces/vector-store.interface';
import { AtlasVectorStoreService } from './retrieval/services/atlas-vector-store.service';
import { ChunkingService } from './retrieval/services/chunking.service';
import { ContextBuilderService } from './retrieval/services/context-builder.service';
import { EmbeddingService } from './retrieval/services/google-embedding.service';
import { RagIngestionService } from './retrieval/services/rag-ingestion.service';
import { RagRetrievalService } from './retrieval/services/rag-retrieval.service';
import { TextExtractionService } from './retrieval/services/text-extraction.service';

@Module({
  imports: [
    FilesModule,
    HealthTrackingModule,
    ModerationModule,
    MongooseModule.forFeature([
      { name: AiConversation.name, schema: AiConversationSchema },
      {
        name: AiConversationMessage.name,
        schema: AiConversationMessageSchema,
      },
      { name: AiFeedback.name, schema: AiFeedbackSchema },
      { name: AiDocument.name, schema: AiDocumentSchema },
      { name: AiDocumentChunk.name, schema: AiDocumentChunkSchema },
    ]),
  ],
  controllers: [
    AiAssistantController,
    AiFeedbacksController,
    AiDocumentsController,
    AiDocumentChunksController,
  ],
  providers: [
    AiAssistantService,
    AiConversationQueryService,
    AiConversationManagementService,
    AiMessageOrchestrationService,
    AiFeedbacksService,
    AiDocumentsService,
    AiDocumentChunksService,
    MedicalAnsweringService,
    PromptBuilderService,
    LlmGatewayService,
    AiResponseOrchestrator,
    AiSafetyService,
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
    AiAssistantService,
    AiFeedbacksService,
    RagIngestionService,
    RagRetrievalService,
  ],
})
export class AiAdvisoryModule {}
