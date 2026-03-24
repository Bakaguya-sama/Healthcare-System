import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { MongoDBAtlasVectorSearch } from '@langchain/mongodb';

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
import {
  AiDocumentChunk,
  AiDocumentChunkDocument,
} from '../ai-document-chunks/entities/ai-document-chunk.entity';

const SYSTEM_PROMPT = `Bạn là trợ lý y tế thông minh của ứng dụng HealthcareApp.
Nhiệm vụ của bạn:
- Trả lời các câu hỏi về sức khỏe, triệu chứng, và lời khuyên y tế cơ bản.
- Giải thích kết quả xét nghiệm và chỉ số sức khỏe theo cách dễ hiểu.
- Khuyến khích người dùng đặt lịch tư vấn với bác sĩ khi cần thiết.

Quy tắc bắt buộc:
- KHÔNG chẩn đoán bệnh cụ thể thay cho bác sĩ.
- KHÔNG kê đơn thuốc hoặc liều dùng.
- KHÔNG cung cấp thông tin sai lệch về y tế.
- Luôn khuyến khích tham khảo ý kiến bác sĩ cho các vấn đề nghiêm trọng.
- Nếu có ngữ cảnh kiến thức được cung cấp, ưu tiên sử dụng ngữ cảnh đó trước khi trả lời.
- Trả lời bằng tiếng Việt, ngắn gọn và dễ hiểu.`;

const EMBEDDING_MODEL = 'gemini-embedding-001';
const MEDICAL_KNOWLEDGE_GAP_RESPONSE =
  'Hiện tại tôi chưa có đủ kiến thức từ nguồn dữ liệu đã được xác thực để trả lời chính xác câu hỏi này. Bạn nên tham khảo bác sĩ hoặc cơ sở y tế để được tư vấn chuyên môn.';

@Injectable()
export class AiAssistantService implements OnModuleInit {
  private readonly logger = new Logger(AiAssistantService.name);
  private genAI: GoogleGenerativeAI;

  // RAG với MongoDB
  private vectorStore: MongoDBAtlasVectorSearch;
  private embeddings: GoogleGenerativeAIEmbeddings;

  constructor(
    @InjectModel(AiConversation.name)
    private aiConversationModel: Model<AiConversationDocument>,
    @InjectModel(AiDocumentChunk.name)
    private aiDocumentChunkModel: Model<AiDocumentChunkDocument>,
    private configService: ConfigService,
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

    try {
      this.genAI = new GoogleGenerativeAI(apiKey || '');

      // Initializing embedding for FAISS
      this.embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: apiKey || '',
        modelName: EMBEDDING_MODEL,
      });

      // Vector store se duoc khoi tao trong onModuleInit sau khi ket noi DB on dinh.
    } catch (error) {
      console.error('[AI Assistant] Failed to initialize Gemini AI:', error);
    }
  }

  // private tryInitializeVectorStore(): boolean {
  //   if (this.vectorStore) {
  //     return true;
  //   }

  //   const apiKey = this.configService.get<string>('GEMINI_API_KEY');
  //   if (!apiKey || apiKey === 'dev_key_placeholder') {
  //     this.logger.warn(
  //       '⚠️ GEMINI_API_KEY is missing. Vector Store will not be initialized.',
  //     );
  //     return false;
  //   }

  //   if (!this.embeddings) {
  //     this.embeddings = new GoogleGenerativeAIEmbeddings({
  //       apiKey,
  //       modelName: 'text-embedding-004',
  //     });
  //   }

  //   const nativeDb = this.aiDocumentChunkModel.db?.db;
  //   if (!nativeDb) {
  //     this.logger.warn(
  //       'MongoDB native db is not ready yet. Deferring Vector Store init.',
  //     );
  //     return false;
  //   }

  //   const nativeCollection = nativeDb.collection(
  //     this.aiDocumentChunkModel.collection.name,
  //   );

  //   this.vectorStore = new MongoDBAtlasVectorSearch(this.embeddings, {
  //     collection: nativeCollection as any,
  //     indexName: 'vector_index',
  //     textKey: 'content',
  //     embeddingKey: 'embedding',
  //   });

  //   this.logger.log('✅ MongoDB Vector Store initialized successfully');
  //   return true;
  // }

  private tryInitializeAtlasVectorStore(): boolean {
    if (this.vectorStore) {
      return true;
    }

    if (!this.embeddings) {
      this.logger.warn(
        '⚠️ GEMINI_API_KEY bị thiếu. Không thể khởi tạo Vector Store.',
      );
      return false;
    }

    const nativeDb = this.aiDocumentChunkModel.db?.db;
    const collectionName = this.aiDocumentChunkModel.collection?.name;

    if (!nativeDb || !collectionName) {
      this.logger.warn(
        '⚠️ MongoDB native collection chưa sẵn sàng. Sẽ thử lại khi gọi API.',
      );
      return false;
    }

    try {
      const nativeCollection = nativeDb.collection(collectionName);
      this.logger.log(
        `[AI Assistant] Atlas target: db=${nativeDb.databaseName}, collection=${collectionName}`,
      );

      this.vectorStore = new MongoDBAtlasVectorSearch(this.embeddings, {
        collection: nativeCollection as unknown as any,
        indexName: 'vector_index',
        textKey: 'content',
        embeddingKey: 'embedding',
      });

      this.logger.log(
        '✅ MongoDBAtlasVectorSearch đã khởi tạo thành công với native collection.',
      );
      return true;
    } catch (error) {
      this.logger.error('❌ Lỗi khởi tạo MongoDBAtlasVectorSearch:', error);
      return false;
    }
  }

  private isValidEmbeddingVector(vector: unknown): vector is number[] {
    return (
      Array.isArray(vector) &&
      vector.length > 0 &&
      vector.every((n) => typeof n === 'number' && !Number.isNaN(n))
    );
  }

  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Try LangChain embeddings first.
    const vectors = await this.embeddings.embedDocuments(texts);
    const invalidVectorIndex = vectors.findIndex(
      (v) => !this.isValidEmbeddingVector(v),
    );

    if (invalidVectorIndex === -1 && vectors.length === texts.length) {
      return vectors;
    }

    this.logger.warn(
      '[AI Assistant] LangChain embeddings trả về rỗng/không hợp lệ, chuyển sang Google embedContent trực tiếp.',
    );

    const embeddingModel = this.genAI.getGenerativeModel({
      model: EMBEDDING_MODEL,
    });

    const fallbackVectors = await Promise.all(
      texts.map(async (text, index) => {
        const response = await embeddingModel.embedContent(text);
        const values = response.embedding?.values;

        if (!this.isValidEmbeddingVector(values)) {
          throw new BadRequestException(
            `Embedding trả về rỗng/không hợp lệ tại chunk index ${index}.`,
          );
        }

        return values;
      }),
    );

    return fallbackVectors;
  }

  private isMedicalQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    const medicalKeywords = [
      'benh',
      'bệnh',
      'trieu chung',
      'triệu chứng',
      'sot',
      'sốt',
      'ho',
      'dau',
      'đau',
      'kho tho',
      'khó thở',
      'chay mau',
      'chảy máu',
      'xuat huyet',
      'xuất huyết',
      'cum',
      'cúm',
      'dengue',
      'influenza',
      'fever',
      'symptom',
      'disease',
      'ran',
      'răng',
      'nha',
      'nha khoa',
      'ran lung',
      'rang lung',
      'ho',
      'sore throat',
      'viêm',
      'nhek',
      'nhức',
      'chảy máu',
      'máu',
      'bệnh tật',
      'vết thương',
      'cơn đau',
      'chóng mặt',
      'buồn nôn',
      'nôn',
      'tiêu chảy',
      'táo bón',
      'ghế',
      'tiểu tiện',
      'tiểu',
      'tinh trùng',
      'mất ngủ',
      'mất ngủ',
    ];

    return medicalKeywords.some((keyword) => lowerQuery.includes(keyword));
  }

  private async buildRagContext(query: string): Promise<{
    context: string | null;
    hasRelevantSource: boolean;
  }> {
    if (!this.vectorStore && !this.tryInitializeAtlasVectorStore()) {
      this.logger.warn(
        '[AI Assistant] Vector Store chưa sẵn sàng, bỏ qua RAG cho lượt trả lời này.',
      );
      return { context: null, hasRelevantSource: false };
    }

    try {
      const vectorStoreWithScore = this.vectorStore as unknown as {
        similaritySearchWithScore?: (
          queryText: string,
          k?: number,
        ) => Promise<Array<[any, number]>>;
      };

      let results: any[] = [];

      // 🎯 Ưu tiên sử dụng similaritySearchWithScore để có score filtering
      if (
        typeof vectorStoreWithScore.similaritySearchWithScore === 'function'
      ) {
        const scoredResults =
          await vectorStoreWithScore.similaritySearchWithScore(query, 3);

        // 🚨 STRICT THRESHOLD: 0.85 (để tránh false positives từ word overlap)
        const SCORE_THRESHOLD = 0.85;
        const filteredByScore = scoredResults.filter(
          ([, score]) => typeof score === 'number' && score >= SCORE_THRESHOLD,
        );

        // 📊 DEBUG LOGGING - hiển thị tất cả scores
        const scoreDetails = scoredResults
          .map(
            ([doc, score], idx) =>
              `  [${idx + 1}] Score ${(score as number).toFixed(4)}: ${(doc.pageContent as string).substring(0, 50)}...`,
          )
          .join('\n');

        this.logger.log(
          `[AI Assistant] RAG Query="${query}"\n${scoreDetails}\nPassed threshold (${SCORE_THRESHOLD.toFixed(2)}): ${filteredByScore.length}/${scoredResults.length}`,
        );

        // Chỉ sử dụng results nếu vượt qua score threshold
        results = filteredByScore.map(([doc]) => doc);
      } else {
        // Fallback: sử dụng unfiltered search nếu similaritySearchWithScore không có
        results = await this.vectorStore.similaritySearch(query, 3);
      }

      if (!results.length) {
        return { context: null, hasRelevantSource: false };
      }

      const contextBlocks = results
        .map((doc, index) => `[Nguon ${index + 1}] ${doc.pageContent}`)
        .join('\n\n');

      return {
        context: `Du lieu tham khao tu Vector DB:\n${contextBlocks}`,
        hasRelevantSource: true,
      };
    } catch (error) {
      this.logger.warn(
        '[AI Assistant] Truy van RAG that bai, tiep tuc tra loi khong co context.',
      );
      this.logger.error('[AI Assistant] RAG retrieval error:', error);
      return { context: null, hasRelevantSource: false };
    }
  }

  // 🟢 HÀM NÀY CHẠY TỰ ĐỘNG SAU KHI NESTJS KHỞI ĐỘNG XONG
  onModuleInit() {
    this.tryInitializeAtlasVectorStore();
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
    const isMedicalRelatedQuestion = this.isMedicalQuery(dto.message);

    if (isMedicalRelatedQuestion && !ragContext.hasRelevantSource) {
      conversation.messages.push({
        role: MessageRole.ASSISTANT,
        content: MEDICAL_KNOWLEDGE_GAP_RESPONSE,
        timestamp: new Date(),
      });

      conversation.messageCount = conversation.messages.length;
      conversation.lastMessageAt = new Date();
      await conversation.save();

      return {
        statusCode: 200,
        message: 'Message processed successfully',
        data: {
          conversationId: conversation._id,
          userMessage: dto.message,
          aiResponse: MEDICAL_KNOWLEDGE_GAP_RESPONSE,
          messageCount: conversation.messageCount,
          groundedByRag: false,
        },
      };
    }

    // Get AI response
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    // Chuyển đổi role cho phù hợp với yêu cầu của Gemini API
    const chatHistory = conversation.messages.map((m) => {
      let mappedRole = m.role.toString();
      // Nếu role trong DB là 'assistant', chuyển thành 'model' cho Gemini
      if (mappedRole === 'assistant' || mappedRole === MessageRole.ASSISTANT) {
        mappedRole = 'model';
      }
      return {
        role: mappedRole,
        parts: [{ text: m.content }],
      };
    });

    const chat = model.startChat({ history: chatHistory.slice(0, -1) });

    try {
      const userPromptForModel = ragContext
        ? `${dto.message}\n\n${ragContext.context}\n\nHuong dan: Chi su dung thong tin tham khao neu phu hop va khong mau thuan quy tac an toan y te.`
        : dto.message;

      const result = await chat.sendMessage(userPromptForModel);
      const aiResponse = result.response.text();

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

      // If quota exceeded, use mock response for development
      if (
        errorMessage.includes('429') ||
        errorMessage.includes('Quota exceeded')
      ) {
        console.warn(
          '[AI Assistant] Gemini API quota exceeded. Using mock response for development.',
        );

        const mockResponses = [
          'Dựa vào triệu chứng bạn mô tả, tôi khuyến nghị bạn nên: 1) Ghi chép lại các triệu chứng chi tiết, 2) Đo nhiệt độ và huyết áp, 3) Liên hệ với bác sĩ để được tư vấn chuyên môn. Các triệu chứng này cần được kiểm tra kỹ lưỡng.',
          'Tôi hiểu rằng bạn đang lo lắng về sức khỏe. Để đưa ra lời khuyên tốt nhất, bạn nên: 1) Nêu rõ thêm các triệu chứng, 2) Cho biết thời gian bắt đầu, 3) Nếu có bệnh lý nền. Hãy gặp bác sĩ sớm nhất có thể.',
          'Cảm ơn bạn đã chia sẻ thông tin sức khỏe. Dựa vào lời mô tả, điều quan trọng là: 1) Theo dõi các triệu chứng thêm, 2) Giữ vệ sinh cá nhân tốt, 3) Uống đủ nước, 4) Liên hệ bác sĩ ngay nếu tình trạng xấu đi. Sức khỏe của bạn là ưu tiên hàng đầu.',
          'Tôi chỉ có thể cung cấp thông tin tổng quát. Để được chẩn đoán chính xác, bạn cần gặp bác sĩ chuyên khoa. Trong lúc chờ, hãy: 1) Ghi chép chi tiết triệu chứng, 2) Rước lịch sử y tế cá nhân và gia đình, 3) Chuẩn bị các câu hỏi cho bác sĩ.',
        ];

        const mockResponse =
          mockResponses[Math.floor(Math.random() * mockResponses.length)];

        // Add mock AI response to history
        conversation.messages.push({
          role: MessageRole.ASSISTANT,
          content: mockResponse,
          timestamp: new Date(),
        });

        conversation.messageCount = conversation.messages.length;
        conversation.lastMessageAt = new Date();
        await conversation.save();

        return {
          statusCode: 200,
          message:
            'Message processed successfully (Mock response - API quota exceeded)',
          data: {
            conversationId: conversation._id,
            userMessage: dto.message,
            aiResponse: mockResponse,
            messageCount: conversation.messageCount,
            isDevelopmentMock: true,
          },
        };
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

  /**
   * 📚 RAG BƯỚC 1: NẠP DỮ LIỆU Y KHOA VÀO MONGODB(VECTOR DB)
   */
  async seedMedicalKnowledgeBase() {
    this.logger.log(
      '[AI Assistant] Bắt đầu nạp dữ liệu y khoa vào Vector DB...',
    );

    if (!this.vectorStore && !this.tryInitializeAtlasVectorStore()) {
      throw new BadRequestException(
        'MongoDB Atlas Vector Store chưa sẵn sàng. Kiểm tra kết nối DB, API key, và thử lại.',
      );
    }

    // Dữ liệu mẫu (Sau này bạn có thể gọi từ DB bảng ai_documents ra)
    const sampleMedicalData = `
    Bệnh Sốt Xuất Huyết (Dengue Fever):
    Triệu chứng cơ bản: Sốt cao đột ngột 39-40 độ C, kéo dài 2-7 ngày. Đau đầu dữ dội vùng trán, nhức hai hố mắt. Có chấm xuất huyết ở dưới da, chảy máu chân răng hoặc chảy máu cam.
    Cách xử lý tại nhà: Uống nhiều nước (Oresol, nước trái cây). Dùng thuốc hạ sốt Paracetamol. Tuyệt đối không dùng Aspirin hay Ibuprofen vì gây chảy máu.
    
    Bệnh Cúm A (Influenza A):
    Triệu chứng: Sốt, ớn lạnh, ho, đau họng, chảy nước mũi, nghẹt mũi, đau nhức cơ bắp và mệt mỏi nghiêm trọng.
    Cách xử lý: Nghỉ ngơi ngơi nhiều, uống nhiều nước ấm. Có thể sử dụng thuốc giảm ho, thuốc xịt mũi không kê đơn. Nếu khó thở phải đến bệnh viện ngay.
    `;

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });

    const docs = await textSplitter.createDocuments([sampleMedicalData]);
    this.logger.log(`Đã băm tài liệu thành ${docs.length} đoạn nhỏ.`);

    try {
      const texts = docs.map((d) => d.pageContent);
      const vectors = await this.generateEmbeddings(texts);

      if (vectors.length !== texts.length) {
        throw new BadRequestException(
          'Không thể tạo embedding hợp lệ: số lượng vector không khớp với số lượng đoạn văn bản.',
        );
      }

      const embeddingDimension = vectors[0].length;
      this.logger.log(
        `[AI Assistant] Embedding được tạo thành công: chunks=${vectors.length}, dimension=${embeddingDimension}`,
      );

      const beforeEmbeddingCount =
        await this.aiDocumentChunkModel.collection.countDocuments({
          $expr: { $gt: [{ $size: '$embedding' }, 0] },
        });

      const now = new Date();
      const payload = texts.map((content, index) => ({
        content,
        embedding: vectors[index],
        chunkIndex: index,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }));

      const insertResult =
        await this.aiDocumentChunkModel.collection.insertMany(payload);

      const afterEmbeddingCount =
        await this.aiDocumentChunkModel.collection.countDocuments({
          $expr: { $gt: [{ $size: '$embedding' }, 0] },
        });

      this.logger.log(
        `[AI Assistant] Inserted docs: ${insertResult.insertedCount}. Embedding docs trước seed: ${beforeEmbeddingCount}, sau seed: ${afterEmbeddingCount}`,
      );

      if (afterEmbeddingCount <= beforeEmbeddingCount) {
        throw new BadRequestException(
          'Seed chạy xong nhưng không thấy embedding mới trong collection Atlas.',
        );
      }

      this.logger.log(
        'Hoàn tất! Đã lưu Database vào MongoDB Atlas Vector Search.',
      );
      return {
        statusCode: 200,
        message: 'Đã nạp kiến thức vào MongoDB Atlas thành công!',
      };
    } catch (error) {
      this.logger.error('Lỗi khi nạp vào MongoDB Vector:', error);
      throw new BadRequestException('Không thể lưu vào MongoDB Vector Search.');
    }
  }

  /**
   * 🔍 RAG BƯỚC 2: TÌM KIẾM KIẾN THỨC THEO CÂU HỎI
   */
  async testVectorSearch(query: string) {
    if (!this.vectorStore && !this.tryInitializeAtlasVectorStore()) {
      throw new BadRequestException(
        'MongoDB Atlas Vector Store chưa được khởi tạo. Hãy kiểm tra Atlas Vector Index và kết nối DB.',
      );
    }

    try {
      const results = await this.vectorStore.similaritySearch(query, 2);
      return {
        statusCode: 200,
        query: query,
        results: results.map((r) => r.pageContent),
      };
    } catch (error) {
      this.logger.error('Lỗi tìm kiếm Vector:', error);
      throw new BadRequestException(
        'Lỗi tìm kiếm dữ liệu. Vui lòng đảm bảo bạn đã tạo Vector Index trên MongoDB Atlas.',
      );
    }
  }
}
