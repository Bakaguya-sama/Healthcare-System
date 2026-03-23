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
- Trả lời bằng tiếng Việt, ngắn gọn và dễ hiểu.`;

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
        modelName: 'text-embedding-004',
      });

      // Vector store se duoc khoi tao trong onModuleInit sau khi ket noi DB on dinh.
    } catch (error) {
      console.error('[AI Assistant] Failed to initialize Gemini AI:', error);
    }
  }

  private tryInitializeVectorStore(): boolean {
    if (this.vectorStore) {
      return true;
    }

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey || apiKey === 'dev_key_placeholder') {
      this.logger.warn(
        '⚠️ GEMINI_API_KEY is missing. Vector Store will not be initialized.',
      );
      return false;
    }

    if (!this.embeddings) {
      this.embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey,
        modelName: 'text-embedding-004',
      });
    }

    const nativeDb = this.aiDocumentChunkModel.db?.db;
    if (!nativeDb) {
      this.logger.warn(
        'MongoDB native db is not ready yet. Deferring Vector Store init.',
      );
      return false;
    }

    const nativeCollection = nativeDb.collection(
      this.aiDocumentChunkModel.collection.name,
    );

    this.vectorStore = new MongoDBAtlasVectorSearch(this.embeddings, {
      collection: nativeCollection as any,
      indexName: 'vector_index',
      textKey: 'content',
      embeddingKey: 'embedding',
    });

    this.logger.log('✅ MongoDB Vector Store initialized successfully');
    return true;
  }

  // 🟢 HÀM NÀY CHẠY TỰ ĐỘNG SAU KHI NESTJS KHỞI ĐỘNG XONG
  async onModuleInit() {
    try {
      this.tryInitializeVectorStore();
    } catch (error) {
      this.logger.error('❌ Failed to initialize MongoDB Vector Store:', error);
    }
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
      const result = await chat.sendMessage(dto.message);
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

    if (!this.tryInitializeVectorStore()) {
      throw new BadRequestException(
        'MongoDB Vector Store chưa sẵn sàng. Vui lòng thử lại sau khi DB kết nối ổn định.',
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
      // Gọi lệnh đẩy document + vector vào MongoDB
      await this.vectorStore.addDocuments(docs);
      this.logger.log(`Hoàn tất! Đã lưu Database vào MongoDB.`);
      return {
        statusCode: 200,
        message: 'Đã nạp kiến thức vào MongoDB thành công!',
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
    if (!this.vectorStore && !this.tryInitializeVectorStore()) {
      throw new BadRequestException(
        'MongoDB Vector Store chưa được khởi tạo. Hãy gọi API Seed Data trước.',
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
