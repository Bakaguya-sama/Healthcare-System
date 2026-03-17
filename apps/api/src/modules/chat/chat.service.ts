import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Message,
  MessageDocument,
  MessageStatus,
  MessageType,
} from './entities/message.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  /**
   * 📝 SEND MESSAGE
   */
  async sendMessage(senderId: string, dto: SendMessageDto) {
    if (!Types.ObjectId.isValid(senderId)) {
      throw new BadRequestException('Invalid sender ID');
    }
    if (!Types.ObjectId.isValid(dto.receiverId)) {
      throw new BadRequestException('Invalid receiver ID');
    }

    if (senderId === dto.receiverId) {
      throw new BadRequestException('Cannot send message to yourself');
    }

    if (dto.replyToId && !Types.ObjectId.isValid(dto.replyToId)) {
      throw new BadRequestException('Invalid reply-to ID');
    }

    // Handle attachments - support both new array format and legacy single file
    let attachments = dto.attachments || [];
    if (dto.fileUrl && dto.fileName) {
      attachments.push({
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
      });
    }

    const message = await this.messageModel.create({
      senderId: new Types.ObjectId(senderId),
      receiverId: new Types.ObjectId(dto.receiverId),
      senderType: dto.senderType,
      content: dto.content,
      type: dto.type || MessageType.TEXT,
      status: MessageStatus.SENT,
      attachments: attachments.length > 0 ? attachments : undefined,
      fileUrl: dto.fileUrl, // Keep for backward compatibility
      fileName: dto.fileName,
      fileSize: dto.fileSize,
      mimeType: dto.mimeType,
      replyToId: dto.replyToId ? new Types.ObjectId(dto.replyToId) : undefined,
      reactions: dto.reactions || [],
    });

    await message.populate('senderId', 'name email avatarUrl');
    await message.populate('receiverId', 'name email avatarUrl');

    return {
      statusCode: 201,
      message: 'Message sent successfully',
      data: message,
    };
  }

  /**
   * 💬 GET CONVERSATION (2-way conversation between 2 users)
   */
  async getConversation(userId: string, otherId: string, query: QueryMessageDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(otherId)) {
      throw new BadRequestException('Invalid other user ID');
    }

    const userObjId = new Types.ObjectId(userId);
    const otherObjId = new Types.ObjectId(otherId);

    const filter = {
      $or: [
        { senderId: userObjId, receiverId: otherObjId },
        { senderId: otherObjId, receiverId: userObjId },
      ],
      isDeleted: false,
    };

    // Apply date filters
    if (query.startDate || query.endDate) {
      filter['createdAt'] = {};
      if (query.startDate) {
        filter['createdAt']['$gte'] = new Date(query.startDate);
      }
      if (query.endDate) {
        filter['createdAt']['$lte'] = new Date(query.endDate);
      }
    }

    const skip = (query.page - 1) * query.limit;
    const sort = {
      [query.sortBy || 'createdAt']: query.sortOrder || 1,
    };

    const [messages, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .populate('senderId', 'name email avatarUrl')
        .populate('receiverId', 'name email avatarUrl')
        .populate('replyToId', 'content senderId')
        .sort(sort)
        .skip(skip)
        .limit(query.limit),
      this.messageModel.countDocuments(filter),
    ]);

    return {
      statusCode: 200,
      message: 'Conversation retrieved successfully',
      data: messages,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * 📊 GET ALL MESSAGES (admin/for filtering)
   */
  async findAll(query: QueryMessageDto) {
    const filter: any = {
      isDeleted: false,
    };

    if (query.userId) {
      if (!Types.ObjectId.isValid(query.userId)) {
        throw new BadRequestException('Invalid user ID');
      }
      filter.$or = [
        { senderId: new Types.ObjectId(query.userId) },
        { receiverId: new Types.ObjectId(query.userId) },
      ];
    }

    if (query.type) {
      filter.type = query.type;
    }

    if (query.status) {
      filter.status = query.status;
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

    const skip = (query.page - 1) * query.limit;
    const sort = {
      [query.sortBy || 'createdAt']: query.sortOrder || -1,
    };

    const [messages, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .populate('senderId', 'name email avatarUrl')
        .populate('receiverId', 'name email avatarUrl')
        .sort(sort)
        .skip(skip)
        .limit(query.limit),
      this.messageModel.countDocuments(filter),
    ]);

    return {
      statusCode: 200,
      message: 'Messages retrieved successfully',
      data: messages,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * 🔍 GET MESSAGE BY ID
   */
  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid message ID');
    }

    const message = await this.messageModel
      .findById(new Types.ObjectId(id))
      .populate('senderId', 'name email avatarUrl')
      .populate('receiverId', 'name email avatarUrl')
      .populate('replyToId', 'content senderId');

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return {
      statusCode: 200,
      message: 'Message retrieved successfully',
      data: message,
    };
  }

  /**
   * ✏️ UPDATE MESSAGE (edit content, reactions)
   */
  async update(userId: string, id: string, dto: UpdateMessageDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid message ID');
    }

    const message = await this.messageModel.findById(new Types.ObjectId(id));

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Only sender can edit
    if (message.senderId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to edit this message',
      );
    }

    // Can't edit deleted messages
    if (message.isDeleted) {
      throw new BadRequestException('Cannot edit deleted message');
    }

    // Track edit history if content changes
    if (dto.content && dto.content !== message.content) {
      if (!message.editHistory) {
        message.editHistory = [];
      }
      message.editHistory.push({
        content: message.content,
        editedAt: new Date(),
      });
      message.content = dto.content;
      message.isEdited = true;
      message.editedAt = new Date();
    }

    if (dto.status) message.status = dto.status;
    if (dto.reactions) message.reactions = dto.reactions;

    await message.save();

    return {
      statusCode: 200,
      message: 'Message updated successfully',
      data: message,
    };
  }

  /**
   * ✅ MARK MESSAGE AS READ
   */
  async markAsRead(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid message ID');
    }

    const message = await this.messageModel.findById(new Types.ObjectId(id));

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Only receiver can mark as read
    if (message.receiverId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to mark this message as read',
      );
    }

    message.isRead = true;
    message.status = MessageStatus.READ;
    message.readAt = new Date();
    await message.save();

    return {
      statusCode: 200,
      message: 'Message marked as read',
      data: { isRead: true, readAt: message.readAt },
    };
  }

  /**
   * 📌 PIN MESSAGE
   */
  async pinMessage(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid message ID');
    }

    const message = await this.messageModel.findById(new Types.ObjectId(id));

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Sender or receiver can pin
    if (
      message.senderId.toString() !== userId &&
      message.receiverId.toString() !== userId
    ) {
      throw new ForbiddenException(
        'You are not authorized to pin this message',
      );
    }

    message.isPinned = true;
    await message.save();

    return {
      statusCode: 200,
      message: 'Message pinned successfully',
      data: { isPinned: true },
    };
  }

  /**
   * 📌 UNPIN MESSAGE
   */
  async unpinMessage(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid message ID');
    }

    const message = await this.messageModel.findById(new Types.ObjectId(id));

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Sender or receiver can unpin
    if (
      message.senderId.toString() !== userId &&
      message.receiverId.toString() !== userId
    ) {
      throw new ForbiddenException(
        'You are not authorized to unpin this message',
      );
    }

    message.isPinned = false;
    await message.save();

    return {
      statusCode: 200,
      message: 'Message unpinned successfully',
      data: { isPinned: false },
    };
  }

  /**
   * 🗑️ DELETE MESSAGE (soft delete)
   */
  async remove(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid message ID');
    }

    const message = await this.messageModel.findById(new Types.ObjectId(id));

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Only sender can delete
    if (message.senderId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to delete this message',
      );
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    return {
      statusCode: 200,
      message: 'Message deleted successfully',
    };
  }

  /**
   * 📊 GET UNREAD MESSAGE COUNT
   */
  async getUnreadCount(userId: string, otherId?: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const filter: any = {
      receiverId: new Types.ObjectId(userId),
      isRead: false,
      isDeleted: false,
    };

    if (otherId) {
      if (!Types.ObjectId.isValid(otherId)) {
        throw new BadRequestException('Invalid other user ID');
      }
      filter.senderId = new Types.ObjectId(otherId);
    }

    const unreadCount = await this.messageModel.countDocuments(filter);

    return {
      statusCode: 200,
      message: 'Unread count retrieved successfully',
      data: {
        unreadCount,
      },
    };
  }

  /**
   * 📌 GET PINNED MESSAGES
   */
  async getPinnedMessages(userId: string, otherId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(otherId)) {
      throw new BadRequestException('Invalid other user ID');
    }

    const userObjId = new Types.ObjectId(userId);
    const otherObjId = new Types.ObjectId(otherId);

    const pinnedMessages = await this.messageModel
      .find({
        $or: [
          { senderId: userObjId, receiverId: otherObjId },
          { senderId: otherObjId, receiverId: userObjId },
        ],
        isPinned: true,
        isDeleted: false,
      })
      .populate('senderId', 'name email avatarUrl')
      .populate('receiverId', 'name email avatarUrl')
      .sort({ createdAt: -1 });

    return {
      statusCode: 200,
      message: 'Pinned messages retrieved successfully',
      data: pinnedMessages,
    };
  }

  /**
   * ✅ MARK CONVERSATION AS READ
   */
  async markConversationAsRead(userId: string, otherId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(otherId)) {
      throw new BadRequestException('Invalid other user ID');
    }

    const result = await this.messageModel.updateMany(
      {
        senderId: new Types.ObjectId(otherId),
        receiverId: new Types.ObjectId(userId),
        isRead: false,
        isDeleted: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
          status: MessageStatus.READ,
        },
      },
    );

    return {
      statusCode: 200,
      message: 'Conversation marked as read',
      data: {
        modifiedCount: result.modifiedCount,
      },
    };
  }

  /**
   * 📈 GET CONVERSATION STATS
   */
  async getConversationStats(userId: string, otherId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(otherId)) {
      throw new BadRequestException('Invalid other user ID');
    }

    const userObjId = new Types.ObjectId(userId);
    const otherObjId = new Types.ObjectId(otherId);

    const stats = await this.messageModel.aggregate([
      {
        $match: {
          $or: [
            { senderId: userObjId, receiverId: otherObjId },
            { senderId: otherObjId, receiverId: userObjId },
          ],
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          unreadMessages: {
            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] },
          },
          messagesByType: {
            $push: '$type',
          },
          lastMessage: { $max: '$createdAt' },
          firstMessage: { $min: '$createdAt' },
        },
      },
    ]);

    const data = stats[0] || {
      totalMessages: 0,
      unreadMessages: 0,
      messagesByType: [],
      lastMessage: null,
      firstMessage: null,
    };

    return {
      statusCode: 200,
      message: 'Conversation stats retrieved successfully',
      data,
    };
  }
}
