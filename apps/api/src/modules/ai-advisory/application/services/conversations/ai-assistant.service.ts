import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  Optional,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  AiConversation,
  AiConversationDocument,
} from '../../../domain/entities/conversations/ai-conversation.entity';
import {
  AiConversationMessage,
  AiConversationMessageDocument,
} from '../../../domain/entities/conversations/ai-conversation-message.entity';
import {
  StartConversationDto,
  AiSendMessageDto,
  RateConversationDto,
  ArchiveConversationDto,
  UpdateConversationDto,
  QueryConversationDto,
  QueryConversationMessageDto,
  AiHealthProfileSummaryDto,
} from '../../../presentation/dto/conversations/conversation.dto';
import { RagRetrievalService } from '../retrieval/rag-retrieval.service';
import { ContextBuilderService } from '../retrieval/context-builder.service';
import { MedicalAnsweringService } from './medical-answering.service';
import { PromptBuilderService } from './prompt-builder.service';
import { LlmGatewayService } from '../../../infrastructure/adapters/retrieval/llm-gateway.service';
import { CloudinaryService } from '../../../../../infrastructure/files/cloudinary.service';
import { AiResponseOrchestrator } from './ai-response-orchestrator.service';
import { AiSafetyService } from './ai-safety.service';
import {
  HEALTH_PROFILE,
  type HealthProfilePort,
} from '../../../../health-tracking/public-api';
import {
  AI_QUOTA_PORT,
  type AiQuotaPort,
} from '../../../../billing/public-api';
import { AiConversationQueryService } from './ai-conversation-query.service';
import { AiConversationManagementService } from './ai-conversation-management.service';
import { AiMessageOrchestrationService } from './ai-message-orchestration.service';
import { isProviderUsageMetadataMissing } from '../../errors/provider-usage-metadata-missing.exception';

type UploadedMedicalImage = {
  mimetype?: string;
  originalname: string;
  buffer: Buffer;
  size: number;
};

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);
  private readonly conversationQueries: AiConversationQueryService;
  private readonly conversationManagement: AiConversationManagementService;
  private readonly messageOrchestration: AiMessageOrchestrationService;

  constructor(
    @InjectModel(AiConversation.name)
    private aiConversationModel: Model<AiConversationDocument>,
    @InjectModel(AiConversationMessage.name)
    private aiConversationMessageModel: Model<AiConversationMessageDocument>,
    private configService: ConfigService,
    private readonly ragRetrievalService: RagRetrievalService,
    private readonly contextBuilderService: ContextBuilderService,
    private readonly medicalAnsweringService: MedicalAnsweringService,
    private readonly promptBuilderService: PromptBuilderService,
    private readonly llmGatewayService: LlmGatewayService,
    private readonly cloudinaryService: CloudinaryService,
    @Optional() private readonly responseOrchestrator?: AiResponseOrchestrator,
    @Optional() private readonly aiSafetyService?: AiSafetyService,
    @Optional()
    @Inject(HEALTH_PROFILE)
    private readonly healthProfileReader?: HealthProfilePort,
    @Optional() conversationQueries?: AiConversationQueryService,
    @Optional() conversationManagement?: AiConversationManagementService,
    @Optional() messageOrchestration?: AiMessageOrchestrationService,
    @Optional() @Inject(AI_QUOTA_PORT) private readonly aiQuota?: AiQuotaPort,
  ) {
    this.conversationQueries =
      conversationQueries ??
      new AiConversationQueryService(
        aiConversationModel,
        aiConversationMessageModel,
      );
    this.conversationManagement =
      conversationManagement ??
      new AiConversationManagementService(aiConversationModel);
    this.messageOrchestration =
      messageOrchestration ??
      new AiMessageOrchestrationService(
        aiConversationModel,
        aiConversationMessageModel,
        configService,
        ragRetrievalService,
        contextBuilderService,
        medicalAnsweringService,
        promptBuilderService,
        llmGatewayService,
        cloudinaryService,
        responseOrchestrator,
        aiSafetyService,
        healthProfileReader,
      );
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.logger.log(
      '[AI Assistant] GEMINI_API_KEY loaded:',
      apiKey ? '✅ Key exists' : '❌ Key missing',
    );

    if (!apiKey || apiKey === 'dev_key_placeholder') {
      this.logger.warn(
        '[AI Assistant] WARNING: GEMINI_API_KEY is not properly configured',
      );
    }
  }

  /**
   * 🎯 START NEW CONVERSATION
   */
  async startConversation(userId: string, dto: StartConversationDto) {
    return this.messageOrchestration.startConversation(userId, dto);
  }

  /**
   * 💬 SEND MESSAGE TO AI (get AI response)
   */
  async sendMessage(
    userId: string,
    conversationId: string,
    dto: AiSendMessageDto,
    imageFiles: UploadedMedicalImage[] = [],
    idempotencyKey?: string,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    if (!this.aiQuota) {
      throw new HttpException('AI quota service is unavailable', 503);
    }
    const quota = this.aiQuota;
    const reservation = await quota.reserve({
      userId,
      idempotencyKey: idempotencyKey.trim(),
      // Conservative admission envelope only. Settlement always uses provider
      // usage metadata returned by the orchestration boundary.
      estimatedInputTokens:
        Math.ceil((dto.message?.length ?? 0) / 4) +
        1_800 +
        (imageFiles.length > 0 ? 2_000 : 0),
      maxOutputTokens: 1_536,
    });
    if (reservation.status !== 'reserved') {
      throw new ConflictException(
        reservation.status === 'committed'
          ? 'This idempotency key has already completed; retrieve the conversation result instead.'
          : 'This idempotency key cannot be processed again.',
      );
    }
    try {
      const result = await this.messageOrchestration.sendMessage(
        userId,
        conversationId,
        dto,
        imageFiles,
      );
      const { quotaUsage, ...response } = result;
      await quota.commit({
        reservationId: reservation.reservationId,
        inputTokens: quotaUsage.inputTokens,
        outputTokens: quotaUsage.outputTokens,
      });
      return response;
    } catch (error) {
      if (isProviderUsageMetadataMissing(error)) {
        await quota.markUsageReconciliationRequired(
          reservation.reservationId,
          'provider_usage_metadata_missing',
        );
        throw error;
      }
      await quota.release(reservation.reservationId);
      throw error;
    }
  }

  async getHealthProfileSummary(
    userId: string,
    input: AiHealthProfileSummaryDto,
  ) {
    return this.messageOrchestration.getHealthProfileSummary(userId, input);
  }

  /**
   * 📋 GET ALL CONVERSATIONS
   */
  async getConversations(userId: string, query: QueryConversationDto) {
    return this.conversationQueries.getConversations(userId, query);
  }

  /**
   * 🔍 GET SINGLE CONVERSATION
   */
  async getConversation(
    userId: string,
    conversationId: string,
    query: QueryConversationMessageDto,
  ) {
    return this.conversationQueries.getConversation(
      userId,
      conversationId,
      query,
    );
  }

  /**
   * ⭐ TOGGLE FAVORITE
   */
  async toggleFavorite(userId: string, conversationId: string) {
    return this.conversationManagement.toggleFavorite(userId, conversationId);
  }

  /**
   * 📌 ARCHIVE CONVERSATION
   */
  async archiveConversation(
    userId: string,
    conversationId: string,
    dto: ArchiveConversationDto,
  ) {
    return this.conversationManagement.archiveConversation(
      userId,
      conversationId,
      dto,
    );
  }

  /**
   * ⭐ RATE CONVERSATION
   */
  async rateConversation(
    userId: string,
    conversationId: string,
    dto: RateConversationDto,
  ) {
    return this.conversationManagement.rateConversation(
      userId,
      conversationId,
      dto,
    );
  }

  /**
   * ✏️ UPDATE CONVERSATION
   */
  async updateConversation(
    userId: string,
    conversationId: string,
    dto: UpdateConversationDto,
  ) {
    return this.conversationManagement.updateConversation(
      userId,
      conversationId,
      dto,
    );
  }

  /**
   * 🗑️ DELETE CONVERSATION
   */
  async deleteConversation(userId: string, conversationId: string) {
    return this.conversationManagement.deleteConversation(
      userId,
      conversationId,
    );
  }

  /**
   * 📊 GET CONVERSATION STATISTICS
   */
  async getConversationStats(userId: string, conversationId: string) {
    return this.conversationQueries.getConversationStats(
      userId,
      conversationId,
    );
  }

  /**
   * 📈 GET USER CONVERSATION SUMMARY
   */
  async getUserConversationSummary(userId: string) {
    return this.conversationQueries.getUserConversationSummary(userId);
  }

  /**
   * 🔍 SEARCH CONVERSATIONS
   */
  async searchConversations(
    userId: string,
    searchQuery: string,
    query: QueryConversationDto,
  ) {
    return this.conversationQueries.searchConversations(
      userId,
      searchQuery,
      query,
    );
  }
}
