import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  AiConversation,
  AiConversationDocument,
} from './entities/ai-conversation.entity';
import {
  AiConversationMessage,
  AiConversationMessageDocument,
} from './entities/ai-conversation-message.entity';
import {
  StartConversationDto,
  AiSendMessageDto,
  RateConversationDto,
  ArchiveConversationDto,
  UpdateConversationDto,
  QueryConversationDto,
  QueryConversationMessageDto,
  AiHealthProfileSummaryDto,
} from './dto/conversation.dto';
import { RagRetrievalService } from '../retrieval/services/rag-retrieval.service';
import { ContextBuilderService } from '../retrieval/services/context-builder.service';
import { MedicalAnsweringService } from './services/medical-answering.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { LlmGatewayService } from './services/llm-gateway.service';
import { CloudinaryService } from '../../../infrastructure/files/cloudinary.service';
import { AiResponseOrchestrator } from './services/ai-response-orchestrator.service';
import { AiSafetyService } from './services/ai-safety.service';
import {
  HEALTH_PROFILE_READER,
  type HealthProfileReader,
} from '../../health-tracking/public-api';
import { AiConversationQueryService } from './ai-conversation-query.service';
import { AiConversationManagementService } from './ai-conversation-management.service';
import { AiMessageOrchestrationService } from './ai-message-orchestration.service';

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
    @Inject(HEALTH_PROFILE_READER)
    private readonly healthProfileReader?: HealthProfileReader,
    @Optional() conversationQueries?: AiConversationQueryService,
    @Optional() conversationManagement?: AiConversationManagementService,
    @Optional() messageOrchestration?: AiMessageOrchestrationService,
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
  ) {
    return this.messageOrchestration.sendMessage(
      userId,
      conversationId,
      dto,
      imageFiles,
    );
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
