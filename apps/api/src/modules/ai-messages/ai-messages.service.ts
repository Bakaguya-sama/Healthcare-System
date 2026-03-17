import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiMessage, AiMessageDocument, MessageFeedback } from './entities/ai-message.entity';
import { CreateAiMessageDto, UpdateAiMessageDto, QueryAiMessageDto } from './dto/create-ai-message.dto';

@Injectable()
export class AiMessagesService {
  constructor(
    @InjectModel(AiMessage.name) private aiMessageModel: Model<AiMessageDocument>,
  ) {}

  async create(userId: string, createDto: CreateAiMessageDto): Promise<AiMessage> {
    try {
      const message = new this.aiMessageModel({
        ...createDto,
        sessionId: new Types.ObjectId(createDto.sessionId),
        userId: new Types.ObjectId(userId),
        tokenCount: createDto.tokenCount || 0,
        isFlagged: false,
      });
      return await message.save();
    } catch (error) {
      throw new BadRequestException(`Failed to create AI message: ${error.message}`);
    }
  }

  async findBySessionId(sessionId: string, query: QueryAiMessageDto): Promise<{ data: AiMessage[]; total: number }> {
    const { page = 1, limit = 10, role, feedback, isFlagged, sortBy = 'createdAt', sortOrder = -1 } = query;

    const filter: any = { sessionId: new Types.ObjectId(sessionId) };

    if (role) filter.role = role;
    if (feedback) filter.feedback = feedback;
    if (isFlagged !== undefined) filter.isFlagged = isFlagged;

    const skip = (page - 1) * limit;
    const data = await this.aiMessageModel
      .find(filter)
      .sort({ [sortBy]: sortOrder as any })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.aiMessageModel.countDocuments(filter);

    return { data, total };
  }

  async findByUserId(userId: string, query: QueryAiMessageDto): Promise<{ data: AiMessage[]; total: number }> {
    const { page = 1, limit = 10, role, feedback, isFlagged, sortBy = 'createdAt', sortOrder = -1 } = query;

    const filter: any = { userId: new Types.ObjectId(userId) };

    if (role) filter.role = role;
    if (feedback) filter.feedback = feedback;
    if (isFlagged !== undefined) filter.isFlagged = isFlagged;

    const skip = (page - 1) * limit;
    const data = await this.aiMessageModel
      .find(filter)
      .sort({ [sortBy]: sortOrder as any })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.aiMessageModel.countDocuments(filter);

    return { data, total };
  }

  async findAll(query: QueryAiMessageDto): Promise<{ data: AiMessage[]; total: number }> {
    const { page = 1, limit = 10, role, feedback, isFlagged, sortBy = 'createdAt', sortOrder = -1 } = query;

    const filter: any = {};

    if (role) filter.role = role;
    if (feedback) filter.feedback = feedback;
    if (isFlagged !== undefined) filter.isFlagged = isFlagged;

    const skip = (page - 1) * limit;
    const data = await this.aiMessageModel
      .find(filter)
      .sort({ [sortBy]: sortOrder as any })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.aiMessageModel.countDocuments(filter);

    return { data, total };
  }

  async findById(messageId: string): Promise<AiMessage> {
    const message = await this.aiMessageModel.findById(new Types.ObjectId(messageId)).exec();
    if (!message) {
      throw new NotFoundException(`AI Message with ID ${messageId} not found`);
    }
    return message;
  }

  async findByIdAndUserId(messageId: string, userId: string): Promise<AiMessage> {
    const message = await this.aiMessageModel
      .findOne({
        _id: new Types.ObjectId(messageId),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (!message) {
      throw new NotFoundException(`AI Message with ID ${messageId} not found or access denied`);
    }
    return message;
  }

  async update(messageId: string, userId: string, updateDto: UpdateAiMessageDto): Promise<AiMessage> {
    const message = await this.findByIdAndUserId(messageId, userId);

    Object.assign(message, updateDto);
    return await message.save();
  }

  async addFeedback(messageId: string, userId: string, feedback: MessageFeedback, notes?: string): Promise<AiMessage> {
    const message = await this.findByIdAndUserId(messageId, userId);

    message.feedback = feedback;
    if (notes) message.feedbackNotes = notes;

    return await message.save();
  }

  async flagMessage(messageId: string, reason: string): Promise<AiMessage> {
    const message = await this.aiMessageModel.findByIdAndUpdate(
      new Types.ObjectId(messageId),
      {
        isFlagged: true,
        flagReason: reason,
      },
      { new: true },
    );

    if (!message) {
      throw new NotFoundException(`AI Message with ID ${messageId} not found`);
    }
    return message;
  }

  async unflagMessage(messageId: string): Promise<AiMessage> {
    const message = await this.aiMessageModel.findByIdAndUpdate(
      new Types.ObjectId(messageId),
      {
        isFlagged: false,
        flagReason: null,
      },
      { new: true },
    );

    if (!message) {
      throw new NotFoundException(`AI Message with ID ${messageId} not found`);
    }
    return message;
  }

  async delete(messageId: string, userId: string): Promise<AiMessage> {
    const message = await this.aiMessageModel.findOneAndDelete({
      _id: new Types.ObjectId(messageId),
      userId: new Types.ObjectId(userId),
    });

    if (!message) {
      throw new NotFoundException(`AI Message with ID ${messageId} not found or access denied`);
    }
    return message;
  }

  async deleteById(messageId: string): Promise<AiMessage> {
    const message = await this.aiMessageModel.findByIdAndDelete(new Types.ObjectId(messageId));

    if (!message) {
      throw new NotFoundException(`AI Message with ID ${messageId} not found`);
    }
    return message;
  }

  async deleteBySessionId(sessionId: string): Promise<{ deletedCount: number }> {
    const result = await this.aiMessageModel.deleteMany({
      sessionId: new Types.ObjectId(sessionId),
    });

    return { deletedCount: result.deletedCount };
  }
}
