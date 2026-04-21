import {
  Injectable,
  BadRequestException,
  HttpException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  AiConversation,
  AiConversationDocument,
  ConversationType,
  MessageRole,
} from './entities/ai-conversation.entity';
import {
  StartConversationDto,
  AiSendMessageDto,
  RateConversationDto,
  ArchiveConversationDto,
  UpdateConversationDto,
  QueryConversationDto,
} from './dto/conversation.dto';
import { RagRetrievalService } from '../rag/services/rag-retrieval.service';
import { ContextBuilderService } from '../rag/services/context-builder.service';
import { Citation } from '../rag/interfaces/context-builder.interface';
import { MedicalAnsweringService } from './services/medical-answering.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { LlmGatewayService } from './services/llm-gateway.service';

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    @InjectModel(AiConversation.name)
    private aiConversationModel: Model<AiConversationDocument>,
    private configService: ConfigService,
    private readonly ragRetrievalService: RagRetrievalService,
    private readonly contextBuilderService: ContextBuilderService,
    private readonly medicalAnsweringService: MedicalAnsweringService,
    private readonly promptBuilderService: PromptBuilderService,
    private readonly llmGatewayService: LlmGatewayService,
  ) {
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

  private async buildRagContext(query: string): Promise<{
    context: string | null;
    hasRelevantSource: boolean;
    citations: Citation[];
    confidence: number;
  }> {
    try {
      const retrieval = await this.ragRetrievalService.retrieve({
        query,
        limit: 3,
        minScore: 0.65,
      });

      const builtContext = this.contextBuilderService.build({
        hits: retrieval.hits,
        tokenBudget: 1200,
      });

      const topScore = retrieval.hits[0]?.score ?? null;
      const confidence = this.medicalAnsweringService.estimateConfidence(
        topScore,
        builtContext.citations.length,
      );
      const hasRelevantSource = Boolean(builtContext.context);

      if (!hasRelevantSource) {
        return {
          context: null,
          hasRelevantSource: false,
          citations: [],
          confidence: 0,
        };
      }

      const scoreSummary = retrieval.hits
        .map(
          (hit, index) =>
            `  [${index + 1}] Score ${hit.score.toFixed(4)}: ${hit.content.substring(0, 50)}...`,
        )
        .join('\n');

      this.logger.log(
        `[AI Assistant] RAG Query="${query}"\n${scoreSummary}\nPassed threshold (${retrieval.threshold.toFixed(2)}): ${retrieval.hits.length}`,
      );

      return {
        context: builtContext.context,
        hasRelevantSource,
        citations: builtContext.citations,
        confidence,
      };
    } catch (error) {
      this.logger.warn(
        '[AI Assistant] Truy van RAG that bai, tiep tuc tra loi khong co context.',
      );
      this.logger.error('[AI Assistant] RAG retrieval error:', error);
      return {
        context: null,
        hasRelevantSource: false,
        citations: [],
        confidence: 0,
      };
    }
  }

  private shouldFallbackWithoutContext(question: string): boolean {
    const normalized = question.trim().toLowerCase();
    const words = normalized.split(/\s+/).filter(Boolean);

    const vaguePatterns = [
      'la gi',
      'là gì',
      'nhu the nao',
      'như thế nào',
      'co sao khong',
      'có sao không',
      'duoc khong',
      'được không',
      'tu van',
      'tư vấn',
      'giup toi',
      'giúp tôi',
      'nen lam gi',
      'nên làm gì',
      'lam sao',
      'làm sao',
    ];

    const hasVaguePattern = vaguePatterns.some((pattern) =>
      normalized.includes(pattern),
    );

    const explicitMedicalSignals = [
      'sot',
      'sốt',
      'ho',
      'dau',
      'đau',
      'kho tho',
      'khó thở',
      'xet nghiem',
      'xét nghiệm',
      'chi so',
      'chỉ số',
      'huyet ap',
      'huyết áp',
      'nhip tim',
      'nhịp tim',
      'spo2',
      'duong huyet',
      'đường huyết',
      'trieu chung',
      'triệu chứng',
    ];

    const hasExplicitSignal = explicitMedicalSignals.some((signal) =>
      normalized.includes(signal),
    );

    const looksAmbiguous = words.length <= 8 || hasVaguePattern;

    // No context + explicit medical signal => strict safe fallback.
    // No context + ambiguous question => allow LLM to ask clarifying questions.
    return hasExplicitSignal || !looksAmbiguous;
  }

  private isKnowledgeSeekingQuery(question: string): boolean {
    const normalized = question.trim().toLowerCase();

    const knowledgePatterns = [
      'la gi',
      'là gì',
      'dinh nghia',
      'định nghĩa',
      'tai sao',
      'tại sao',
      'co che',
      'cơ chế',
      'nguyen nhan',
      'nguyên nhân',
      'phan biet',
      'phân biệt',
      'la loai gi',
      'là loại gì',
      'khac nhau nhu the nao',
      'khác nhau như thế nào',
      'gom nhat',
      'gồm những gì',
      'bao gom',
      'bao gồm',
    ];

    const hasSymptomMarkers =
      normalized.includes('bi') ||
      normalized.includes('bị') ||
      normalized.includes('toi co') ||
      normalized.includes('tôi có') ||
      normalized.includes('toi cam thay') ||
      normalized.includes('tôi cảm thấy') ||
      normalized.includes('dang') ||
      normalized.includes('đang');

    const isKnowledgePattern = knowledgePatterns.some((pattern) =>
      normalized.includes(pattern),
    );

    return isKnowledgePattern && !hasSymptomMarkers;
  }

  /**
   * 🎯 START NEW CONVERSATION
   */
  async startConversation(userId: string, dto: StartConversationDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const conversation = await this.aiConversationModel.create({
      userId: new Types.ObjectId(userId),
      type: dto.type || ConversationType.GENERAL_CONSULTATION,
      topic: dto.initialQuestion,
      messages: [
        {
          role: MessageRole.USER,
          content: dto.initialQuestion,
          timestamp: new Date(),
        },
      ],
      messageCount: 1,
      lastMessageAt: new Date(),
      tags: dto.tags || [],
      status: 'active',
    });

    return {
      statusCode: 201,
      message: 'Conversation started successfully',
      data: conversation,
    };
  }

  /**
   * 💬 SEND MESSAGE TO AI (get AI response)
   */
  async sendMessage(
    userId: string,
    conversationId: string,
    dto: AiSendMessageDto,
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid conversation ID');
    }

    const conversation = await this.aiConversationModel.findById(
      new Types.ObjectId(conversationId),
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to access this conversation',
      );
    }

    // Add user message to history
    conversation.messages.push({
      role: MessageRole.USER,
      content: dto.message,
      timestamp: new Date(),
    });

    const ragContext = await this.buildRagContext(dto.message);

    const chatHistory = this.promptBuilderService.buildChatHistory(
      conversation.messages,
    );

    try {
      let userPromptForModel = '';

      if (!ragContext.hasRelevantSource) {
        // Phân loại ý định câu hỏi khi RAG không tìm thấy nguồn
        if (this.isKnowledgeSeekingQuery(dto.message)) {
          // LUỒNG 1: Câu hỏi kiến thức - Trả lời từ kiến thức chung của LLM
          userPromptForModel = `Người dùng hỏi về kiến thức y khoa: "${dto.message}".

Tài liệu nội bộ hiện không có thông tin cụ thể. Hãy trả lời dựa trên kiến thức y khoa chuyên môn của bạn, nhưng PHẢI kèm theo lưu ý: "Đây là thông tin tham khảo chung từ kiến thức y khoa. Để được xác nhận chính xác, vui lòng tham khảo ý kiến bác sĩ chuyên khoa."`;
        } else if (this.shouldFallbackWithoutContext(dto.message)) {
          // LUỒNG 2: Câu hỏi triệu chứng - Dùng Triage động
          userPromptForModel =
            await this.promptBuilderService.buildDynamicTriagePrompt(
              dto.message,
            );
        } else {
          // LUỒNG 3: Câu hỏi mơ hồ - Để LLM tự hỏi làm rõ
          userPromptForModel = `Người dùng đang hỏi: "${dto.message}".

Dữ liệu tham khảo nội bộ hiện không đủ. Hãy đặt câu hỏi làm rõ để hiểu rõ hơn ý muốn của họ, rồi cung cấp hướng dẫn sơ bộ. Nếu người dùng mô tả triệu chứng cụ thể, hãy đóng vai một trợ lý y tế sơ bộ (Triage Assistant) để giúp họ hiểu tình trạng sức khỏe hiện tại.`;
        }
      } else {
        userPromptForModel = this.promptBuilderService.buildUserPrompt({
          question: dto.message,
          ragContext: ragContext.hasRelevantSource ? ragContext.context : null,
        });
      }

      const systemInstruction =
        await this.promptBuilderService.getSystemPrompt();

      const aiResponse = await this.llmGatewayService.generateMedicalAnswer({
        modelName: 'gemini-2.5-flash-lite',
        systemInstruction,
        history: chatHistory.slice(0, -1),
        userPrompt: userPromptForModel,
      });

      // Add AI response to history
      conversation.messages.push({
        role: MessageRole.ASSISTANT,
        content: aiResponse,
        timestamp: new Date(),
      });

      conversation.messageCount = conversation.messages.length;
      conversation.lastMessageAt = new Date();
      conversation.totalTokensUsed +=
        Math.ceil(dto.message.length / 4) + Math.ceil(aiResponse.length / 4);

      await conversation.save();

      return {
        statusCode: 200,
        message: 'Message processed successfully',
        data: {
          conversationId: conversation._id,
          userMessage: dto.message,
          aiResponse,
          messageCount: conversation.messageCount,
          groundedByRag: ragContext.hasRelevantSource,
          citations: ragContext.citations,
          confidence: ragContext.confidence,
        },
      };
    } catch (error) {
      console.error('[AI Assistant] Gemini API Error:', error);

      const apiKey = this.configService.get<string>('GEMINI_API_KEY');
      console.log('[AI Assistant] Current API Key status:', {
        exists: !!apiKey,
        isPlaceholder: apiKey === 'dev_key_placeholder',
        keyLength: apiKey?.length || 0,
      });

      if (!apiKey || apiKey === 'dev_key_placeholder') {
        throw new BadRequestException(
          'Gemini API Key not configured. Please set GEMINI_API_KEY in .env file and restart the server.',
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      if (error instanceof HttpException) {
        throw new HttpException(
          `AI service error: ${errorMessage}`,
          error.getStatus(),
        );
      }

      throw new BadRequestException(
        `AI service error: ${errorMessage}. Make sure your Gemini API Key is valid and quota is available.`,
      );
    }
  }

  /**
   * 📋 GET ALL CONVERSATIONS
   */
  async getConversations(userId: string, query: QueryConversationDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const filter: any = {
      userId: new Types.ObjectId(userId),
    };

    if (query.type) {
      filter.type = query.type;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.isFavorite !== undefined) {
      filter.isFavorite = query.isFavorite;
    }

    if (query.isArchived !== undefined) {
      filter.isArchived = query.isArchived;
    }

    if (query.isArchived !== undefined) {
      filter.isArchived = query.isArchived;
    }

    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) {
        filter.createdAt.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        filter.createdAt.$lte = new Date(query.endDate);
      }
    }

    if (query.tags && query.tags.length > 0) {
      filter.tags = { $in: query.tags };
    }

    if (query.searchQuery) {
      filter.$or = [
        { topic: { $regex: query.searchQuery, $options: 'i' } },
        { summary: { $regex: query.searchQuery, $options: 'i' } },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const sort: any = {
      [query.sortBy || 'createdAt']: query.sortOrder || -1,
    };

    const [conversations, total] = await Promise.all([
      this.aiConversationModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(query.limit),
      this.aiConversationModel.countDocuments(filter),
    ]);

    return {
      statusCode: 200,
      message: 'Conversations retrieved successfully',
      data: conversations,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * 🔍 GET SINGLE CONVERSATION
   */
  async getConversation(userId: string, conversationId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid conversation ID');
    }

    const conversation = await this.aiConversationModel.findById(
      new Types.ObjectId(conversationId),
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to access this conversation',
      );
    }

    return {
      statusCode: 200,
      message: 'Conversation retrieved successfully',
      data: conversation,
    };
  }

  /**
   * ⭐ TOGGLE FAVORITE
   */
  async toggleFavorite(userId: string, conversationId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid conversation ID');
    }

    const conversation = await this.aiConversationModel.findById(
      new Types.ObjectId(conversationId),
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to modify this conversation',
      );
    }

    conversation.isFavorite = !conversation.isFavorite;
    await conversation.save();

    return {
      statusCode: 200,
      message: 'Favorite status updated',
      data: { isFavorite: conversation.isFavorite },
    };
  }

  /**
   * 📌 ARCHIVE CONVERSATION
   */
  async archiveConversation(
    userId: string,
    conversationId: string,
    dto: ArchiveConversationDto,
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid conversation ID');
    }

    const conversation = await this.aiConversationModel.findById(
      new Types.ObjectId(conversationId),
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to modify this conversation',
      );
    }

    conversation.isArchived = dto.isArchived;
    if (dto.isArchived) {
      conversation.archivedAt = new Date();
      conversation.status = 'archived';
    } else {
      conversation.archivedAt = undefined;
      conversation.status = 'active';
    }

    await conversation.save();

    return {
      statusCode: 200,
      message: dto.isArchived
        ? 'Conversation archived successfully'
        : 'Conversation unarchived successfully',
      data: { isArchived: conversation.isArchived },
    };
  }

  /**
   * ⭐ RATE CONVERSATION
   */
  async rateConversation(
    userId: string,
    conversationId: string,
    dto: RateConversationDto,
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid conversation ID');
    }

    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const conversation = await this.aiConversationModel.findById(
      new Types.ObjectId(conversationId),
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to rate this conversation',
      );
    }

    conversation.rating = dto.rating;
    conversation.ratingComment = dto.comment;
    await conversation.save();

    return {
      statusCode: 200,
      message: 'Conversation rated successfully',
      data: {
        rating: conversation.rating,
        comment: conversation.ratingComment,
      },
    };
  }

  /**
   * ✏️ UPDATE CONVERSATION
   */
  async updateConversation(
    userId: string,
    conversationId: string,
    dto: UpdateConversationDto,
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid conversation ID');
    }

    const conversation = await this.aiConversationModel.findById(
      new Types.ObjectId(conversationId),
    );
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (dto.topic) conversation.topic = dto.topic;
    if (dto.status) conversation.status = dto.status;
    await conversation.save();
    return { statusCode: 200, message: 'Success', data: conversation };
  }

  /**
   * 🗑️ DELETE CONVERSATION
   */
  async deleteConversation(userId: string, conversationId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid conversation ID');
    }

    const conversation = await this.aiConversationModel.findById(
      new Types.ObjectId(conversationId),
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to delete this conversation',
      );
    }

    await this.aiConversationModel.deleteOne({
      _id: new Types.ObjectId(conversationId),
    });
    return { statusCode: 200, message: 'Deleted successfully' };
  }

  /**
   * 📊 GET CONVERSATION STATISTICS
   */
  async getConversationStats(userId: string, conversationId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid conversation ID');
    }

    const conversation = await this.aiConversationModel.findById(
      new Types.ObjectId(conversationId),
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to access this conversation',
      );
    }

    const userMessages = conversation.messages.filter(
      (m) => m.role === MessageRole.USER,
    );
    const assistantMessages = conversation.messages.filter(
      (m) => m.role === MessageRole.ASSISTANT,
    );

    return {
      statusCode: 200,
      message: 'Conversation statistics retrieved successfully',
      data: {
        totalMessages: conversation.messages.length,
        userMessages: userMessages.length,
        assistantMessages: assistantMessages.length,
        totalTokensUsed: conversation.totalTokensUsed,
        averageMessageLength:
          conversation.messages.reduce((sum, m) => sum + m.content.length, 0) /
          (conversation.messages.length || 1),
        conversationType: conversation.type,
        rating: conversation.rating,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    };
  }

  /**
   * 📈 GET USER CONVERSATION SUMMARY
   */
  async getUserConversationSummary(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const stats = await this.aiConversationModel.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalConversations: { $sum: 1 },
          favoriteCount: {
            $sum: { $cond: [{ $eq: ['$isFavorite', true] }, 1, 0] },
          },
          archivedCount: {
            $sum: { $cond: [{ $eq: ['$isArchived', true] }, 1, 0] },
          },
          totalMessages: { $sum: '$messageCount' },
          totalTokensUsed: { $sum: '$totalTokensUsed' },
          averageRating: { $avg: '$rating' },
          conversationsByType: { $push: '$type' },
        },
      },
    ]);

    const data = stats[0] || {
      totalConversations: 0,
      favoriteCount: 0,
      archivedCount: 0,
      totalMessages: 0,
      totalTokensUsed: 0,
      averageRating: 0,
      conversationsByType: [],
    };

    return {
      statusCode: 200,
      message: 'User summary retrieved successfully',
      data,
    };
  }

  /**
   * 🔍 SEARCH CONVERSATIONS
   */
  async searchConversations(
    userId: string,
    searchQuery: string,
    query: QueryConversationDto,
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const filter = {
      userId: new Types.ObjectId(userId),
      $or: [
        { topic: { $regex: searchQuery, $options: 'i' } },
        { summary: { $regex: searchQuery, $options: 'i' } },
        { tags: { $in: [new RegExp(searchQuery, 'i')] } },
      ],
    };

    const skip = (query.page - 1) * query.limit;
    const sort: any = {
      [query.sortBy || 'createdAt']: query.sortOrder || -1,
    };

    const [conversations, total] = await Promise.all([
      this.aiConversationModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(query.limit),
      this.aiConversationModel.countDocuments(filter),
    ]);

    return {
      statusCode: 200,
      message: 'Search results retrieved successfully',
      data: conversations,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }
}
