import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FilesModule } from '../../infrastructure/files/files.module';
import { HealthTrackingModule } from '../health-tracking/health-tracking.module';
import { ModerationModule } from '../moderation/moderation.module';
import { AiAssistantController } from './presentation/conversations/ai-assistant.controller';
import { AiAssistantService } from './application/conversations/ai-assistant.service';
import { AiConversationQueryService } from './application/conversations/ai-conversation-query.service';
import { AiConversationManagementService } from './application/conversations/ai-conversation-management.service';
import { AiMessageOrchestrationService } from './application/conversations/ai-message-orchestration.service';
import {
  AiConversationMessage,
  AiConversationMessageSchema,
} from './domain/conversations/ai-conversation-message.entity';
import {
  AiConversation,
  AiConversationSchema,
} from './domain/conversations/ai-conversation.entity';
import { AiResponseOrchestrator } from './application/conversations/ai-response-orchestrator.service';
import { AiSafetyService } from './application/conversations/ai-safety.service';
import { LlmGatewayService } from './infrastructure/retrieval/llm-gateway.service';
import { MedicalAnsweringService } from './application/conversations/medical-answering.service';
import { PromptBuilderService } from './application/conversations/prompt-builder.service';
import { AiFeedbacksController } from './presentation/feedback/ai-feedbacks.controller';
import { AiFeedbacksService } from './application/feedback/ai-feedbacks.service';
import {
  AiFeedback,
  AiFeedbackSchema,
} from './domain/feedback/ai-feedback.entity';
import { AiDocumentChunksController } from './presentation/knowledge-base/chunks/ai-document-chunks.controller';
import { AiDocumentChunksService } from './application/knowledge-base/chunks/ai-document-chunks.service';
import {
  AiDocumentChunk,
  AiDocumentChunkSchema,
} from './domain/knowledge-base/chunks/ai-document-chunk.entity';
import { AiDocumentsController } from './presentation/knowledge-base/documents/ai-documents.controller';
import { AiDocumentsService } from './application/knowledge-base/documents/ai-documents.service';
import {
  AiDocument,
  AiDocumentSchema,
} from './domain/knowledge-base/documents/ai-document.entity';
import { VECTOR_SEARCH_PORT } from './application/retrieval/vector-store.port';
import { AtlasVectorStoreService } from './infrastructure/retrieval/atlas-vector-store.service';
import { ChunkingService } from './application/retrieval/chunking.service';
import { ContextBuilderService } from './application/retrieval/context-builder.service';
import { EmbeddingService } from './infrastructure/retrieval/google-embedding.service';
import { RagIngestionService } from './application/retrieval/rag-ingestion.service';
import { RagRetrievalService } from './application/retrieval/rag-retrieval.service';
import { TextExtractionService } from './application/retrieval/text-extraction.service';
import { CareSummaryNarrativeService } from './application/care-summary/care-summary-narrative.service';
import { CARE_SUMMARY_NARRATIVE_PORT } from './application/care-summary/care-summary-narrative.port';
import { BillingModule } from '../billing/billing.module';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { User, UserSchema } from '../users/public-api';
import { AuditLog, AuditLogSchema } from '../platform-audit/public-api';
import { IngestApprovedKnowledgeDocumentService } from './application/knowledge-base/documents/ingest-approved-knowledge-document.service';
import { ExternalEvidenceService } from './application/retrieval/external-evidence.service';
import { ExternalEvidenceQueryPolicy } from './domain/policies/external-evidence-query.policy';
import { PubmedLiteratureAdapter } from './infrastructure/retrieval/pubmed-literature.adapter';
import { EXTERNAL_LITERATURE_PORT } from './application/retrieval/external-literature.port';
import {
  KnowledgeCandidate,
  KnowledgeCandidateSchema,
} from './domain/knowledge-base/knowledge-candidate.entity';
import { KnowledgeCandidatesService } from './application/knowledge-base/candidates/knowledge-candidates.service';
import { KnowledgeCandidatesController } from './presentation/knowledge-base/candidates/knowledge-candidates.controller';

@Module({
  imports: [
    FilesModule,
    HealthTrackingModule,
    ModerationModule,
    BillingModule,
    OutboxModule,
    PlatformAuditModule,
    MongooseModule.forFeature([
      { name: AiConversation.name, schema: AiConversationSchema },
      {
        name: AiConversationMessage.name,
        schema: AiConversationMessageSchema,
      },
      { name: AiFeedback.name, schema: AiFeedbackSchema },
      { name: AiDocument.name, schema: AiDocumentSchema },
      { name: AiDocumentChunk.name, schema: AiDocumentChunkSchema },
      { name: KnowledgeCandidate.name, schema: KnowledgeCandidateSchema },
      { name: User.name, schema: UserSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  controllers: [
    AiAssistantController,
    AiFeedbacksController,
    AiDocumentsController,
    AiDocumentChunksController,
    KnowledgeCandidatesController,
  ],
  providers: [
    AiAssistantService,
    AiConversationQueryService,
    AiConversationManagementService,
    AiMessageOrchestrationService,
    AiFeedbacksService,
    AiDocumentsService,
    KnowledgeCandidatesService,
    IngestApprovedKnowledgeDocumentService,
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
    ExternalEvidenceService,
    ExternalEvidenceQueryPolicy,
    PubmedLiteratureAdapter,
    { provide: EXTERNAL_LITERATURE_PORT, useExisting: PubmedLiteratureAdapter },
    ContextBuilderService,
    EmbeddingService,
    AtlasVectorStoreService,
    { provide: VECTOR_SEARCH_PORT, useExisting: AtlasVectorStoreService },
    {
      provide: CARE_SUMMARY_NARRATIVE_PORT,
      useExisting: CareSummaryNarrativeService,
    },
  ],
  exports: [
    AiAssistantService,
    AiFeedbacksService,
    RagIngestionService,
    RagRetrievalService,
    ExternalEvidenceService,
    CARE_SUMMARY_NARRATIVE_PORT,
  ],
})
export class AiAdvisoryModule {}
