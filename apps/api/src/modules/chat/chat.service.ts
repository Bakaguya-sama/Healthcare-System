import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './entities/message.entity';
import { SendMessageDto } from './dto/send-message.dto';
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
    if (!Types.ObjectId.isValid(dto.doctorSessionId)) {
      throw new BadRequestException('Invalid session ID');
    }

    const message = await this.messageModel.create({
      doctorSessionId: new Types.ObjectId(dto.doctorSessionId),
      senderId: new Types.ObjectId(senderId),
      senderType: dto.senderType,
      content: dto.content,
      attachments: dto.attachments || [],
      sentAt: new Date(),
    });

    return {
      statusCode: 201,
      message: 'Message sent successfully',
      data: message,
    };
  }

  /**
   * 💬 GET MESSAGES BY SESSION
   */
  async getSessionMessages(sessionId: string, query: QueryMessageDto) {
    if (!Types.ObjectId.isValid(sessionId)) {
      throw new BadRequestException('Invalid session ID');
    }

    const filter = {
      doctorSessionId: new Types.ObjectId(sessionId),
    };

    const skip = (query.page - 1) * query.limit;

    const [messages, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .sort({ sentAt: 'desc' as any })
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
   * 📊 GET ALL MESSAGES
   */
  async findAll(query: QueryMessageDto) {
    const filter: any = {};

    const skip = (query.page - 1) * query.limit;

    const [messages, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .sort({ sentAt: 'desc' as any })
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

    const message = await this.messageModel.findById(
      new Types.ObjectId(id),
    );

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
   * ✏️ UPDATE MESSAGE
   */
  async update(userId: string, id: string, dto: any) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid message ID');
    }

    const message = await this.messageModel.findById(new Types.ObjectId(id));

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId.toString() !== userId) {
      throw new BadRequestException('Only sender can update message');
    }

    if (dto.content) {
      message.content = dto.content;
    }

    await message.save();

    return {
      statusCode: 200,
      message: 'Message updated successfully',
      data: message,
    };
  }

  /**
   * 🗑️ DELETE MESSAGE
   */
  async remove(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid message ID');
    }

    const message = await this.messageModel.findById(new Types.ObjectId(id));

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId.toString() !== userId) {
      throw new BadRequestException('Only sender can delete message');
    }

    await this.messageModel.deleteOne({ _id: new Types.ObjectId(id) });

    return {
      statusCode: 200,
      message: 'Message deleted successfully',
    };
  }
}
