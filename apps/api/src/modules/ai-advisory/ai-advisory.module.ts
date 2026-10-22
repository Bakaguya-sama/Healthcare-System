import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FilesModule } from '../../infrastructure/files/files.module';
import { HealthTrackingModule } from '../health-tracking/health-tracking.module';
import { ModerationModule } from '../moderation/moderation.module';
import { AiAssistantController } from './presentation/controllers/conversations/ai-assistant.controller';
import { AiAssistantService } from './application/services/conversations/ai-assistant.service';
import { AiConversationQueryService } from './application/services/conversations/ai-conversation-query.service';
import { AiConversationManagementService } from './application/services/conversations/ai-conversation-management.service';
import { AiMessageOrchestrationService } from './application/services/conversations/ai-message-orchestration.service';
import {
  AiConversationMessage,
  AiConversationMessageSchema,
} from './domain/entities/conversations/ai-conversation-message.entity';
import {
  AiConversation,
  AiConversationSchema,
} from './domain/entities/conversations/ai-conversation.entity';
import { AiResponseOrchestrator } from './application/services/conversations/ai-response-orchestrator.service';
import { AiSafetyService } from './application/services/conversations/ai-safety.service';
import { LlmGatewayService } from './infrastructure/adapters/retrieval/llm-gateway.service';
import { MedicalAnsweringService } from './application/services/conversations/medical-answering.service';
import { PromptBuilderService } from './application/services/conversations/prompt-builder.service';
import { AiFeedbacksController } from './presentation/controllers/feedback/ai-feedbacks.controller';
import { AiFeedbacksService } from './application/services/feedback/ai-feedbacks.service';
import {
  AiFeedback,
  AiFeedbackSchema,
} from './domain/entities/feedback/ai-feedback.entity';
import { AiDocumentChunksController } from './presentation/controllers/knowledge-base/chunks/ai-document-chunks.controller';
import { AiDocumentChunksService } from './application/services/knowledge-base/chunks/ai-document-chunks.service';
import {
  AiDocumentChunk,
  AiDocumentChunkSchema,
} from './domain/entities/knowledge-base/chunks/ai-document-chunk.entity';
import { AiDocumentsController } from './presentation/controllers/knowledge-base/documents/ai-documents.controller';
import { AiDocumentsService } from './application/services/knowledge-base/documents/ai-documents.service';
import {
  AiDocument,
  AiDocumentSchema,
} from './domain/entities/knowledge-base/documents/ai-document.entity';
import { VECTOR_SEARCH_PORT } from './application/ports/retrieval/vector-store.port';
import { AtlasVectorStoreService } from './infrastructure/adapters/retrieval/atlas-vector-store.service';
import { ChunkingService } from './application/services/retrieval/chunking.service';
import { ContextBuilderService } from './application/services/retrieval/context-builder.service';
import { EmbeddingService } from './infrastructure/adapters/retrieval/google-embedding.service';
import { RagIngestionService } from './application/services/retrieval/rag-ingestion.service';
import { RagRetrievalService } from './application/services/retrieval/rag-retrieval.service';
import { TextExtractionService } from './application/services/retrieval/text-extraction.service';
import { CareSummaryNarrativeService } from './application/services/care-summary/care-summary-narrative.service';
import { CARE_SUMMARY_NARRATIVE_PORT } from './application/ports/care-summary/care-summary-narrative.port';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    FilesModule,
    HealthTrackingModule,
    ModerationModule,
    BillingModule,
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
    CareSummaryNarrativeService,
    RagIngestionService,
    RagRetrievalService,
    ContextBuilderService,
    EmbeddingService,
    AtlasVectorStoreService,
    { provide: VECTOR_SEARCH_PORT, useExisting: AtlasVectorStoreService },
    { provide: CARE_SUMMARY_NARRATIVE_PORT, useExisting: CareSummaryNarrativeService },
  ],
  exports: [
    AiAssistantService,
    AiFeedbacksService,
    RagIngestionService,
    RagRetrievalService,
    CARE_SUMMARY_NARRATIVE_PORT,
  ],
})
export class AiAdvisoryModule {}
