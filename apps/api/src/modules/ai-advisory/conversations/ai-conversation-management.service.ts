import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ArchiveConversationDto,
  RateConversationDto,
  UpdateConversationDto,
} from './dto/conversation.dto';
import {
  AiConversation,
  AiConversationDocument,
} from './entities/ai-conversation.entity';

@Injectable()
export class AiConversationManagementService {
  constructor(
    @InjectModel(AiConversation.name)
    private readonly conversations: Model<AiConversationDocument>,
  ) {}

  async toggleFavorite(userId: string, conversationId: string) {
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

    const conversation = await this.conversations.findById(
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

    const conversation = await this.conversations.findById(
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

    const conversation = await this.conversations.findById(
      new Types.ObjectId(conversationId),
    );
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (dto.topic) conversation.topic = dto.topic;
    if (dto.status) conversation.status = dto.status;
    await conversation.save();
    return { statusCode: 200, message: 'Success', data: conversation };
  }

  async deleteConversation(userId: string, conversationId: string) {
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

    if (conversation.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to delete this conversation',
      );
    }

    await this.conversations.deleteOne({
      _id: new Types.ObjectId(conversationId),
    });
    return { statusCode: 200, message: 'Deleted successfully' };
  }
}
