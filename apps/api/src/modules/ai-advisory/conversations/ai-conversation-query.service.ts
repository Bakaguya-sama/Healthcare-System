import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
} from '../../../common/pagination';
import { toLiteralCaseInsensitiveRegex } from '../../../common/query/search-pattern';
import {
  QueryConversationDto,
  QueryConversationMessageDto,
} from './dto/conversation.dto';
import {
  AiConversation,
  AiConversationDocument,
  MessageRole,
} from './entities/ai-conversation.entity';
import {
  AiConversationMessage,
  AiConversationMessageDocument,
} from './entities/ai-conversation-message.entity';

const AI_CONVERSATION_LIST_PROJECTION =
  '_id userId type topic summary followUpAction totalTokens totalMessages lastMessageAt isArchived archivedAt isFavorite rating status completedAt tags createdAt updatedAt';
const AI_CONVERSATION_DETAIL_PROJECTION = `${AI_CONVERSATION_LIST_PROJECTION} ratingComment`;
const AI_MESSAGE_READ_PROJECTION =
  '_id conversationId role content timestamp attachments sentiment tokens createdAt updatedAt';

@Injectable()
export class AiConversationQueryService {
  constructor(
    @InjectModel(AiConversation.name)
    private readonly conversations: Model<AiConversationDocument>,
    @InjectModel(AiConversationMessage.name)
    private readonly messages: Model<AiConversationMessageDocument>,
  ) {}

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
      const searchPattern = toLiteralCaseInsensitiveRegex(query.searchQuery);
      filter.$or = [{ topic: searchPattern }, { summary: searchPattern }];
    }

    const cursorFilter: Record<string, unknown> = { ...filter };
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || -1;
    if (query.cursor) {
      try {
        const cursor = decodeCursor(query.cursor);
        const cursorDate = new Date(cursor.sortValue);
        if (Number.isNaN(cursorDate.getTime())) throw new InvalidCursorError();
        const comparator = sortOrder === 1 ? '$gt' : '$lt';
        cursorFilter.$or = [
          { [sortField]: { [comparator]: cursorDate } },
          {
            [sortField]: cursorDate,
            _id: { [comparator]: new Types.ObjectId(cursor.id) },
          },
        ];
      } catch (error) {
        if (error instanceof InvalidCursorError)
          throw new BadRequestException('Invalid conversation cursor');
        throw error;
      }
    }
    const skip = query.cursor ? 0 : (query.page - 1) * query.limit;
    const sort: any = {
      [sortField]: sortOrder,
      _id: sortOrder,
    };

    const [conversations, total] = await Promise.all([
      this.conversations
        .find(cursorFilter)
        .select(AI_CONVERSATION_LIST_PROJECTION)
        .sort(sort)
        .skip(skip)
        .limit(query.limit + 1)
        .lean()
        .exec(),
      this.conversations.countDocuments(filter),
    ]);

    const hasNextPage = conversations.length > query.limit;
    const data = hasNextPage
      ? conversations.slice(0, query.limit)
      : conversations;
    const last = data.at(-1) as Record<string, unknown> | undefined;
    const sortValue = last?.[query.sortBy || 'createdAt'];
    return {
      statusCode: 200,
      message: 'Conversations retrieved successfully',
      data,
      nextCursor:
        hasNextPage && sortValue && last?._id
          ? encodeCursor({
              sortValue: new Date(sortValue as string | Date).toISOString(),
              id: (last._id as { toString(): string }).toString(),
            })
          : null,
      hasNextPage,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  async getConversation(
    userId: string,
    conversationId: string,
    query: QueryConversationMessageDto,
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid conversation ID');
    }

    const conversationObjectId = new Types.ObjectId(conversationId);
    const conversation = await this.conversations
      .findOne({
        _id: conversationObjectId,
        userId: new Types.ObjectId(userId),
      })
      .select(AI_CONVERSATION_DETAIL_PROJECTION)
      .lean()
      .exec();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const sortOrder = query.sortOrder || -1;
    const comparator = sortOrder === 1 ? '$gt' : '$lt';
    const messageFilter: Record<string, unknown> = {
      conversationId: conversationObjectId,
    };
    if (query.cursor) {
      try {
        const cursor = decodeCursor(query.cursor);
        const cursorDate = new Date(cursor.sortValue);
        if (Number.isNaN(cursorDate.getTime())) throw new InvalidCursorError();
        messageFilter.$or = [
          { timestamp: { [comparator]: cursorDate } },
          {
            timestamp: cursorDate,
            _id: { [comparator]: new Types.ObjectId(cursor.id) },
          },
        ];
      } catch (error) {
        if (error instanceof InvalidCursorError)
          throw new BadRequestException('Invalid conversation message cursor');
        throw error;
      }
    }
    const skip = query.cursor ? 0 : (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.messages
        .find(messageFilter)
        .select(AI_MESSAGE_READ_PROJECTION)
        .sort({ timestamp: sortOrder, _id: sortOrder })
        .skip(skip)
        .limit(query.limit + 1)
        .lean()
        .exec(),
      this.messages.countDocuments({
        conversationId: conversationObjectId,
      }),
    ]);
    const hasNextPage = rows.length > query.limit;
    const messages = hasNextPage ? rows.slice(0, query.limit) : rows;
    const lastMessage = messages.at(-1) as
      | { timestamp?: Date; _id?: Types.ObjectId }
      | undefined;

    return {
      statusCode: 200,
      message: 'Conversation retrieved successfully',
      data: conversation,
      messages,
      nextCursor:
        hasNextPage && lastMessage && lastMessage.timestamp && lastMessage._id
          ? encodeCursor({
              sortValue: new Date(lastMessage.timestamp).toISOString(),
              id: String(lastMessage._id),
            })
          : null,
      hasNextPage,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  async getConversationStats(userId: string, conversationId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid conversation ID');
    }

    const conversation = await this.conversations.findById(
      new Types.ObjectId(conversationId),
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const [stats] = await this.messages.aggregate([
      { $match: { conversationId: new Types.ObjectId(conversationId) } },
      {
        $project: {
          role: 1,
          contentLength: { $strLenCP: { $ifNull: ['$content', ''] } },
        },
      },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          userMessages: {
            $sum: { $cond: [{ $eq: ['$role', MessageRole.USER] }, 1, 0] },
          },
          assistantMessages: {
            $sum: { $cond: [{ $eq: ['$role', MessageRole.ASSISTANT] }, 1, 0] },
          },
          averageMessageLength: { $avg: '$contentLength' },
        },
      },
    ]);

    return {
      statusCode: 200,
      message: 'Conversation statistics retrieved successfully',
      data: {
        totalMessages: stats?.totalMessages ?? 0,
        userMessages: stats?.userMessages ?? 0,
        assistantMessages: stats?.assistantMessages ?? 0,
        totalTokensUsed: conversation.totalTokensUsed ?? 0,
        averageMessageLength: stats?.averageMessageLength ?? 0,
        conversationType: conversation.type,
        rating: conversation.rating,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    };
  }

  async getUserConversationSummary(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const stats = await this.conversations.aggregate([
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

  async searchConversations(
    userId: string,
    searchQuery: string,
    query: QueryConversationDto,
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const searchPattern = toLiteralCaseInsensitiveRegex(searchQuery);
    const filter = {
      userId: new Types.ObjectId(userId),
      $or: [
        { topic: searchPattern },
        { summary: searchPattern },
        { tags: { $in: [searchPattern] } },
      ],
    };

    const skip = (query.page - 1) * query.limit;
    const sort: any = {
      [query.sortBy || 'createdAt']: query.sortOrder || -1,
      _id: query.sortOrder || -1,
    };

    const [conversations, total] = await Promise.all([
      this.conversations
        .find(filter)
        .select(AI_CONVERSATION_LIST_PROJECTION)
        .sort(sort)
        .skip(skip)
        .limit(query.limit)
        .lean()
        .exec(),
      this.conversations.countDocuments(filter),
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
