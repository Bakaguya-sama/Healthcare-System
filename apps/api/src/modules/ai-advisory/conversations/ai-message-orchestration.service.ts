import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AiConversation,
  AiConversationDocument,
  ConversationType,
  MessageRole,
  ConversationMessage,
} from './entities/ai-conversation.entity';
import {
  AiConversationMessage,
  AiConversationMessageDocument,
} from './entities/ai-conversation-message.entity';
import {
  StartConversationDto,
  AiSendMessageDto,
  AiHealthProfileSummaryDto,
} from './dto/conversation.dto';
import { RagRetrievalService } from '../retrieval/services/rag-retrieval.service';
import { ContextBuilderService } from '../retrieval/services/context-builder.service';
import { Citation } from '../retrieval/interfaces/context-builder.interface';
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

export type UploadedMedicalImage = {
  mimetype?: string;
  originalname: string;
  buffer: Buffer;
  size: number;
};

type UploadedImageMetadata = {
  publicId: string;
  secureUrl: string;
  fileType: 'image';
  mimeType: string;
  originalName: string;
  size: number;
  base64Data: string;
};

const AI_MESSAGE_READ_PROJECTION =
  '_id conversationId role content timestamp attachments sentiment tokens createdAt updatedAt';

@Injectable()
export class AiMessageOrchestrationService {
  private readonly logger = new Logger(AiMessageOrchestrationService.name);

  constructor(
    @InjectModel(AiConversation.name)
    private readonly aiConversationModel: Model<AiConversationDocument>,
    @InjectModel(AiConversationMessage.name)
    private readonly aiConversationMessageModel: Model<AiConversationMessageDocument>,
    private readonly configService: ConfigService,
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
  ) {}

  private get responseGateway(): AiResponseOrchestrator | LlmGatewayService {
    return this.responseOrchestrator ?? this.llmGatewayService;
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
        minScore: 0.85,
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

  private validateMedicalImage(file: UploadedMedicalImage): void {
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Only image files are supported');
    }
  }

  private isGenericGreeting(message?: string): boolean {
    if (!message) return false;

    const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim();
    const hasHello =
      normalized.includes('xin chao') || normalized.includes('xin chào');
    const hasConsult =
      normalized.includes('toi can tu van') ||
      normalized.includes('tôi cần tư vấn');

    return hasHello && hasConsult;
  }

  private buildTopicFromExchange(
    userMessage?: string,
    assistantMessage?: string,
  ): string | null {
    const parts = [userMessage, assistantMessage]
      .map((text) => text?.trim())
      .filter(Boolean) as string[];

    if (parts.length === 0) return null;

    const combined = parts.join(' - ').replace(/\s+/g, ' ').trim();
    if (combined.length < 5) return null;

    return combined.length > 240 ? `${combined.slice(0, 237)}...` : combined;
  }

  private sanitizeTopicSummary(summary: string, maxLength: number): string {
    const normalized = summary
      .replace(/^["'“”]+|["'“”]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
  }

  private async uploadConversationImages(
    conversationId: string,
    files: UploadedMedicalImage[],
  ): Promise<UploadedImageMetadata[]> {
    const folder = `healthcare/chat/ai/attachments/${conversationId}`;
    const uploadedFiles: UploadedImageMetadata[] = [];

    for (const file of files) {
      this.validateMedicalImage(file);

      const uploadResult = await this.cloudinaryService.uploadFile(
        file,
        folder,
        'image',
      );

      uploadedFiles.push({
        publicId: uploadResult.publicId,
        secureUrl: uploadResult.secureUrl,
        fileType: 'image',
        mimeType: file.mimetype ?? 'image/jpeg',
        originalName: file.originalname,
        size: file.size,
        base64Data: file.buffer.toString('base64'),
      });
    }

    return uploadedFiles;
  }

  async startConversation(userId: string, dto: StartConversationDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const timestamp = new Date();
    const conversation = await this.aiConversationModel.create({
      userId: new Types.ObjectId(userId),
      type: dto.type || ConversationType.GENERAL_CONSULTATION,
      topic: dto.initialQuestion,
      messageCount: 1,
      lastMessageAt: timestamp,
      tags: dto.tags || [],
      status: 'active',
    });
    await this.aiConversationMessageModel.create({
      conversationId: conversation._id,
      role: MessageRole.USER,
      content: dto.initialQuestion,
      timestamp,
    });

    return {
      statusCode: 201,
      message: 'Conversation started successfully',
      data: conversation,
    };
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    dto: AiSendMessageDto,
    images?: UploadedMedicalImage[],
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid conversation ID');
    }

    const conversation = await this.aiConversationModel
      .findOne({
        _id: new Types.ObjectId(conversationId),
        userId: new Types.ObjectId(userId),
      })
      .select('_id type rating createdAt updatedAt totalTokensUsed')
      .lean()
      .exec();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to access this conversation',
      );
    }

    const recentMessages = await this.aiConversationMessageModel
      .find({ conversationId: conversation._id })
      .select(AI_MESSAGE_READ_PROJECTION)
      .sort({ timestamp: -1, _id: -1 })
      .limit(30)
      .lean<ConversationMessage[]>()
      .exec();
    const conversationHistory = recentMessages.reverse();

    const normalizedMessage = this.aiSafetyService
      ? this.aiSafetyService.normalizeUserMessage(dto.message)
      : (dto.message?.trim() ?? '');
    const normalizedImages = (images ?? []).filter(Boolean);

    if (!normalizedMessage && normalizedImages.length === 0) {
      throw new BadRequestException('Message text or image is required');
    }

    const uploadedImages =
      normalizedImages.length > 0
        ? await this.uploadConversationImages(conversationId, normalizedImages)
        : [];

    const messageContent = normalizedMessage || 'Người dùng gửi ảnh y khoa';

    // BƯỚC 1: Phân tích ảnh (nếu có) để lấy mô tả văn bản
    let ragQuery = normalizedMessage;
    let imageDescription = '';
    let imageDescriptions: string[] = [];

    if (uploadedImages.length > 0) {
      this.logger.log(
        `[AI Assistant] Analyzing ${uploadedImages.length} image(s) to generate context...`,
      );
      const descriptionPrompt =
        this.promptBuilderService.getImageDescriptionPrompt();

      try {
        imageDescription = await this.responseGateway.generateImageDescription({
          modelName: 'gemini-2.5-flash-lite',
          systemInstruction: descriptionPrompt,
          userImages: uploadedImages.map((img) => ({
            mimeType: img.mimeType,
            base64Data: img.base64Data,
          })),
        });

        const parts = imageDescription
          .split(/\n\s*(?=Image\s+\d+\s*:)/i)
          .map((part) => part.trim())
          .filter(Boolean);

        if (parts.length > 0) {
          imageDescriptions = parts
            .map((part) => part.replace(/^Image\s+\d+\s*:\s*/i, '').trim())
            .filter(Boolean);
        }

        if (imageDescriptions.length !== uploadedImages.length) {
          imageDescriptions = uploadedImages.map(() => imageDescription.trim());
        }

        this.logger.log(
          `[AI Assistant] Generated Image Description for RAG: ${imageDescription.substring(0, 100)}...`,
        );
        // Kết hợp mô tả ảnh và câu hỏi để làm giàu truy vấn cho RAG
        ragQuery = `${normalizedMessage} ${imageDescription}`.trim();
      } catch (error) {
        this.logger.error(
          `[AI Assistant] Failed to generate image description. Proceeding with text only.`,
          error,
        );
        ragQuery = normalizedMessage; // Fallback nếu phân tích ảnh lỗi
      }
    }

    const userMessage: ConversationMessage = {
      role: MessageRole.USER,
      content: messageContent,
      timestamp: new Date(),
      attachments:
        uploadedImages.length > 0
          ? uploadedImages.map((uploadedImage, index) => ({
              publicId: uploadedImage.publicId,
              secureUrl: uploadedImage.secureUrl,
              fileType: uploadedImage.fileType,
              mimeType: uploadedImage.mimeType,
              originalName: uploadedImage.originalName,
              size: uploadedImage.size,
              description: imageDescriptions[index] || imageDescription,
            }))
          : undefined,
    };

    // BƯỚC 2: Dùng truy vấn đã được làm giàu để tìm kiếm tài liệu RAG
    const ragContext = ragQuery
      ? await this.buildRagContext(ragQuery)
      : {
          context: null,
          hasRelevantSource: false,
          citations: [],
          confidence: 0,
        };

    const chatHistory = this.promptBuilderService.buildChatHistory([
      ...conversationHistory,
      userMessage,
    ]);

    try {
      let userPromptForModel = '';
      // 💡 FIX: Tạo câu hỏi toàn diện cho LLM, bao gồm cả mô tả ảnh.
      const finalQuestionForModel = imageDescription.trim()
        ? `Với mô tả bệnh/dấu hiệu/triệu chứng: "${imageDescription}".\n\nCâu hỏi của bệnh nhân: "${normalizedMessage}"`
        : normalizedMessage || 'Phân tích ảnh y khoa được đính kèm.';

      // BƯỚC 3: Xây dựng prompt cuối cùng, sử dụng `finalQuestionForModel` đã được làm giàu
      if (!ragContext.hasRelevantSource) {
        // Phân loại ý định câu hỏi khi RAG không tìm thấy nguồn
        if (this.isKnowledgeSeekingQuery(finalQuestionForModel)) {
          // LUỒNG 1: Câu hỏi kiến thức - Trả lời từ kiến thức chung của LLM
          userPromptForModel = `Bệnh nhân hỏi về kiến thức y khoa: "${finalQuestionForModel}".Tài liệu nội bộ hiện không có thông tin cụ thể. Hãy trả lời dựa trên kiến thức y khoa chuyên môn của bạn, nhưng PHẢI kèm theo lưu ý: "Đây là thông tin tham khảo chung từ kiến thức y khoa. Để được xác nhận chính xác, vui lòng tham khảo ý kiến bác sĩ chuyên khoa."`;
        } else if (this.shouldFallbackWithoutContext(finalQuestionForModel)) {
          // LUỒNG 2: Câu hỏi triệu chứng - Dùng Triage động
          userPromptForModel =
            this.promptBuilderService.buildDynamicTriagePrompt(
              finalQuestionForModel,
            );
        } else {
          // LUỒNG 3: Câu hỏi mơ hồ - Để LLM tự hỏi làm rõ
          userPromptForModel = `Người dùng đang hỏi: "${finalQuestionForModel}".
          Dữ liệu tham khảo nội bộ hiện không đủ. Hãy đặt câu hỏi làm rõ để hiểu rõ hơn ý muốn của họ, rồi cung cấp hướng dẫn sơ bộ. Nếu người dùng mô tả triệu chứng cụ thể, hãy đóng vai một trợ lý y tế sơ bộ (Triage Assistant) để giúp họ hiểu tình trạng sức khỏe hiện tại.`;
        }
      } else {
        // LUỒNG 4: Có context RAG - Xây dựng prompt đầy đủ
        userPromptForModel = this.promptBuilderService.buildUserPrompt({
          question: finalQuestionForModel,
          ragContext: ragContext.hasRelevantSource ? ragContext.context : null,
        });
      }

      const systemInstruction =
        await this.promptBuilderService.getSystemPrompt();

      // BƯỚC 4: Gọi LLM để tạo câu trả lời cuối cùng.
      // Không cần gửi lại ảnh vì thông tin đã được chuyển thành văn bản trong prompt.
      const aiResponse = await this.responseGateway.generateMedicalAnswer({
        modelName: 'gemini-2.5-flash-lite',
        systemInstruction,
        history: chatHistory.slice(0, -1),
        userPrompt: userPromptForModel,
        userImages: undefined, // Không gửi lại ảnh ở bước cuối
      });

      // 🟢 BƯỚC XỬ LÝ CHAIN-OF-THOUGHT
      // 1. (Tùy chọn) In ra log backend để Dev dễ debug xem AI đang nghĩ gì
      const thinkMatch = aiResponse.match(/<think>([\s\S]*?)<\/think>/);
      if (thinkMatch) {
        this.logger.debug(`[AI Thoughts]:\n${thinkMatch[1].trim()}`);
      }

      // 2. Xóa bỏ hoàn toàn khối <think>...</think> để lấy câu trả lời sạch
      const cleanAiResponse = aiResponse
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .trim();

      // Đảm bảo không bị chuỗi rỗng nếu AI lỡ lỗi format
      const finalAiResponse =
        cleanAiResponse ||
        'Xin lỗi, hệ thống đang bận xử lý logic. Vui lòng thử lại.';

      const assistantMessage: ConversationMessage = {
        role: MessageRole.ASSISTANT,
        content: finalAiResponse,
        timestamp: new Date(),
      };

      if (
        conversation.messageCount <= 1 ||
        this.isGenericGreeting(conversation.topic)
      ) {
        const lastAssistantMessage = assistantMessage;
        const lastUserMessage = [...conversationHistory, userMessage]
          .reverse()
          .find(
            (message) =>
              message.role === MessageRole.USER &&
              !this.isGenericGreeting(message.content),
          );
        const topicCandidate = this.buildTopicFromExchange(
          lastUserMessage?.content,
          lastAssistantMessage?.content,
        );

        if (topicCandidate) {
          const maxTopicLength = 120;
          let finalTopic = topicCandidate;

          if (topicCandidate.length > maxTopicLength) {
            try {
              const summary = await this.responseGateway.generateTopicSummary({
                modelName: 'gemini-2.5-flash-lite',
                text: topicCandidate,
              });
              finalTopic = this.sanitizeTopicSummary(summary, maxTopicLength);
            } catch (error) {
              this.logger.warn(
                '[AI Assistant] Topic summarization failed, using fallback.',
              );
              finalTopic = this.sanitizeTopicSummary(
                topicCandidate,
                maxTopicLength,
              );
            }
          }

          conversation.topic = finalTopic;
        }
      }

      const responseTimestamp = new Date();
      assistantMessage.timestamp = responseTimestamp;
      await this.aiConversationMessageModel.insertMany([
        { ...userMessage, conversationId: conversation._id },
        { ...assistantMessage, conversationId: conversation._id },
      ]);
      const updatedConversation = await this.aiConversationModel
        .findByIdAndUpdate(
          conversation._id,
          {
            $set: {
              topic: conversation.topic,
              lastMessageAt: responseTimestamp,
            },
            $inc: {
              messageCount: 2,
              totalTokensUsed:
                Math.ceil(messageContent.length / 4) +
                Math.ceil(aiResponse.length / 4),
            },
          },
          { new: true },
        )
        .exec();

      return {
        statusCode: 200,
        message: 'Message processed successfully',
        data: {
          conversationId: conversation._id,
          topic: conversation.topic,
          userMessage: messageContent,
          attachments: uploadedImages.map((uploadedImage) => ({
            publicId: uploadedImage.publicId,
            secureUrl: uploadedImage.secureUrl,
          })),
          finalAiResponse,
          messageCount:
            updatedConversation?.messageCount ?? conversation.messageCount + 2,
          groundedByRag: ragContext.hasRelevantSource,
          citations: ragContext.citations,
          confidence: ragContext.confidence,
        },
      };
    } catch (error) {
      console.error('[AI Assistant] Gemini API Error:', error);

      if (uploadedImages.length > 0) {
        for (const uploadedImage of uploadedImages) {
          try {
            await this.cloudinaryService.deleteFile(
              uploadedImage.publicId,
              'image',
            );
          } catch (cleanupError) {
            this.logger.warn(
              `[AI Assistant] Failed to cleanup image ${uploadedImage.publicId} after AI error`,
            );
            this.logger.error('[AI Assistant] Cleanup error:', cleanupError);
          }
        }
      }

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

  async getHealthProfileSummary(
    userId: string,
    input: AiHealthProfileSummaryDto,
  ) {
    if (!Types.ObjectId.isValid(userId))
      throw new BadRequestException('Invalid user ID');
    if (!this.healthProfileReader) {
      throw new BadRequestException('Health profile reader is unavailable');
    }
    this.logger.log('[AI Assistant] Generating health profile summary...');
    const recentMetrics = await this.healthProfileReader.readRecentMetrics(
      userId,
      30,
    );
    const aiResponse = await this.responseGateway.generateHealthProfileSummary({
      patientProfile: input.patientProfile,
      recentMetrics,
    });
    return aiResponse;
  }
}
