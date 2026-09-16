import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiMessage, AiMessageDocument } from './entities/ai-message.entity';
import {
  CreateAiMessageDto,
  UpdateAiMessageDto,
  QueryAiMessageDto,
} from './dto/create-ai-message.dto';
import { AiSessionsService } from '../ai-sessions/ai-sessions.service';

type MessageSessionFilter = {
  aiSessionId: Types.ObjectId | { $in: Types.ObjectId[] };
};

type MessageSortOrder = 1 | -1;

const AI_MESSAGE_READ_PROJECTION =
  '_id aiSessionId senderType content attachments sentAt createdAt updatedAt';

@Injectable()
export class AiMessagesService {
  constructor(
    @InjectModel(AiMessage.name)
    private aiMessageModel: Model<AiMessageDocument>,
    private aiSessionsService: AiSessionsService,
  ) {}

  async create(
    userId: string,
    createDto: CreateAiMessageDto,
  ): Promise<AiMessage> {
    try {
      const aiSession = await this.aiSessionsService.findById(
        createDto.aiSessionId,
      );

      if (!aiSession || aiSession.patientId.toString() !== userId) {
        throw new NotFoundException('AI Session not found or access denied');
      }

      const message = new this.aiMessageModel({
        ...createDto,
        aiSessionId: new Types.ObjectId(createDto.aiSessionId),
        sentAt: new Date(),
      });
      return await message.save();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(
        `Failed to create AI message: ${errorMessage}`,
      );
    }
  }

  async findBySessionId(
    sessionId: string,
    query: QueryAiMessageDto,
  ): Promise<{ data: AiMessage[]; total: number }> {
    const { page = 1, limit = 10, sortBy = 'sentAt', sortOrder = -1 } = query;
    const resolvedSortOrder: MessageSortOrder = sortOrder === 1 ? 1 : -1;

    const filter: MessageSessionFilter = {
      aiSessionId: new Types.ObjectId(sessionId),
    };

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.aiMessageModel
        .find(filter)
        .select(AI_MESSAGE_READ_PROJECTION)
        .sort({ [sortBy]: resolvedSortOrder, _id: resolvedSortOrder })
        .skip(skip)
        .limit(limit)
        .lean<AiMessage[]>()
        .exec(),
      this.aiMessageModel.countDocuments(filter),
    ]);

    return { data, total };
  }

  async findByUserId(
    userId: string,
    query: QueryAiMessageDto,
  ): Promise<{ data: AiMessage[]; total: number }> {
    const { page = 1, limit = 10, sortBy = 'sentAt', sortOrder = -1 } = query;
    const resolvedSortOrder: MessageSortOrder = sortOrder === 1 ? 1 : -1;
    const skip = (page - 1) * limit;
    const [result] = await this.aiMessageModel.aggregate<{
      data: AiMessage[];
      total: number;
    }>([
      {
        $lookup: {
          from: 'aisessions',
          let: { sessionId: '$aiSessionId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$sessionId'] },
                patientId: new Types.ObjectId(userId),
              },
            },
            { $project: { _id: 1 } },
          ],
          as: 'ownedSession',
        },
      },
      { $match: { 'ownedSession.0': { $exists: true } } },
      { $sort: { [sortBy]: resolvedSortOrder, _id: resolvedSortOrder } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                aiSessionId: 1,
                senderType: 1,
                content: 1,
                attachments: 1,
                sentAt: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
          metadata: [{ $count: 'total' }],
        },
      },
      {
        $project: {
          data: 1,
          total: {
            $ifNull: [{ $arrayElemAt: ['$metadata.total', 0] }, 0],
          },
        },
      },
    ]);

    return result ?? { data: [], total: 0 };
  }

  async findAll(
    query: QueryAiMessageDto,
  ): Promise<{ data: AiMessage[]; total: number }> {
    const { page = 1, limit = 10, sortBy = 'sentAt', sortOrder = -1 } = query;
    const resolvedSortOrder: MessageSortOrder = sortOrder === 1 ? 1 : -1;

    const filter = {};

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.aiMessageModel
        .find(filter)
        .select(AI_MESSAGE_READ_PROJECTION)
        .sort({ [sortBy]: resolvedSortOrder, _id: resolvedSortOrder })
        .skip(skip)
        .limit(limit)
        .lean<AiMessage[]>()
        .exec(),
      this.aiMessageModel.countDocuments(filter),
    ]);

    return { data, total };
  }

  async findById(messageId: string): Promise<AiMessage> {
    const message = await this.aiMessageModel
      .findById(new Types.ObjectId(messageId))
      .exec();
    if (!message) {
      throw new NotFoundException(`AI Message with ID ${messageId} not found`);
    }
    return message;
  }

  async findByIdAndUserId(
    messageId: string,
    userId: string,
  ): Promise<AiMessage> {
    const message = await this.aiMessageModel
      .findById(new Types.ObjectId(messageId))
      .exec();

    if (!message) {
      throw new NotFoundException(
        `AI Message with ID ${messageId} not found or access denied`,
      );
    }

    const session = await this.aiSessionsService.findById(
      message.aiSessionId.toString(),
    );

    if (!session || session.patientId.toString() !== userId) {
      throw new NotFoundException(
        `AI Message with ID ${messageId} not found or access denied`,
      );
    }
    return message;
  }

  async update(
    messageId: string,
    userId: string,
    updateDto: UpdateAiMessageDto,
  ): Promise<AiMessage> {
    const message = await this.findByIdAndUserId(messageId, userId);

    Object.assign(message, updateDto);
    return await message.save();
  }

  async delete(messageId: string, userId: string): Promise<AiMessage> {
    const message = await this.findByIdAndUserId(messageId, userId);
    await this.aiMessageModel.deleteOne({ _id: message._id });

    if (!message) {
      throw new NotFoundException(
        `AI Message with ID ${messageId} not found or access denied`,
      );
    }
    return message;
  }

  async deleteById(messageId: string): Promise<AiMessage> {
    const message = await this.aiMessageModel.findByIdAndDelete(
      new Types.ObjectId(messageId),
    );

    if (!message) {
      throw new NotFoundException(`AI Message with ID ${messageId} not found`);
    }
    return message;
  }

  async deleteBySessionId(
    sessionId: string,
  ): Promise<{ deletedCount: number }> {
    const result = await this.aiMessageModel.deleteMany({
      aiSessionId: new Types.ObjectId(sessionId),
    });

    return { deletedCount: result.deletedCount };
  }
}
