import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiSession, AiSessionDocument, SessionStatus } from './entities/ai-session.entity';
import { CreateAiSessionDto, UpdateAiSessionDto, QueryAiSessionDto } from './dto/create-ai-session.dto';

@Injectable()
export class AiSessionsService {
  constructor(
    @InjectModel(AiSession.name) private aiSessionModel: Model<AiSessionDocument>,
  ) {}

  async create(userId: string, createDto: CreateAiSessionDto): Promise<AiSession> {
    try {
      const session = new this.aiSessionModel({
        userId: new Types.ObjectId(userId),
        ...createDto,
        status: SessionStatus.ACTIVE,
        messageIds: [],
        totalMessages: 0,
        totalTokens: 0,
        keyFindings: {},
        recommendations: {},
      });
      return await session.save();
    } catch (error) {
      throw new BadRequestException(`Failed to create AI session: ${error.message}`);
    }
  }

  async findByUserId(userId: string, query: QueryAiSessionDto): Promise<{ data: AiSession[]; total: number }> {
    const { page = 1, limit = 10, status, sessionType, search, sortBy = 'createdAt', sortOrder = -1 } = query;

    const filter: any = { userId: new Types.ObjectId(userId) };

    if (status) filter.status = status;
    if (sessionType) filter.sessionType = sessionType;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const skip = (page - 1) * limit;
    const data = await this.aiSessionModel
      .find(filter)
      .sort({ [sortBy]: sortOrder as any })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.aiSessionModel.countDocuments(filter);

    return { data, total };
  }

  async findAll(query: QueryAiSessionDto): Promise<{ data: AiSession[]; total: number }> {
    const { page = 1, limit = 10, status, sessionType, search, sortBy = 'createdAt', sortOrder = -1 } = query;

    const filter: any = {};

    if (status) filter.status = status;
    if (sessionType) filter.sessionType = sessionType;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const skip = (page - 1) * limit;
    const data = await this.aiSessionModel
      .find(filter)
      .sort({ [sortBy]: sortOrder as any })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.aiSessionModel.countDocuments(filter);

    return { data, total };
  }

  async findById(sessionId: string): Promise<AiSession> {
    const session = await this.aiSessionModel.findById(new Types.ObjectId(sessionId)).exec();
    if (!session) {
      throw new NotFoundException(`AI Session with ID ${sessionId} not found`);
    }
    return session;
  }

  async findByIdAndUserId(sessionId: string, userId: string): Promise<AiSession> {
    const session = await this.aiSessionModel
      .findOne({
        _id: new Types.ObjectId(sessionId),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (!session) {
      throw new NotFoundException(`AI Session with ID ${sessionId} not found or access denied`);
    }
    return session;
  }

  async update(sessionId: string, userId: string, updateDto: UpdateAiSessionDto): Promise<AiSession> {
    const session = await this.findByIdAndUserId(sessionId, userId);

    Object.assign(session, updateDto);
    return await session.save();
  }

  async addMessage(sessionId: string, messageId: string, tokenCount: number = 0): Promise<AiSession> {
    const session = await this.aiSessionModel.findByIdAndUpdate(
      new Types.ObjectId(sessionId),
      {
        $push: { messageIds: new Types.ObjectId(messageId) },
        $inc: { totalMessages: 1, totalTokens: tokenCount },
      },
      { new: true },
    );

    if (!session) {
      throw new NotFoundException(`AI Session with ID ${sessionId} not found`);
    }
    return session;
  }

  async completeSession(sessionId: string, userId: string, summary?: string): Promise<AiSession> {
    const session = await this.findByIdAndUserId(sessionId, userId);

    session.status = SessionStatus.COMPLETED;
    session.completedAt = new Date();
    if (summary) session.summary = summary;

    return await session.save();
  }

  async archiveSession(sessionId: string, userId: string): Promise<AiSession> {
    const session = await this.findByIdAndUserId(sessionId, userId);

    session.status = SessionStatus.ARCHIVED;
    return await session.save();
  }

  async delete(sessionId: string, userId: string): Promise<AiSession> {
    const session = await this.aiSessionModel.findOneAndDelete({
      _id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId),
    });

    if (!session) {
      throw new NotFoundException(`AI Session with ID ${sessionId} not found or access denied`);
    }
    return session;
  }

  async deleteById(sessionId: string): Promise<AiSession> {
    const session = await this.aiSessionModel.findByIdAndDelete(new Types.ObjectId(sessionId));

    if (!session) {
      throw new NotFoundException(`AI Session with ID ${sessionId} not found`);
    }
    return session;
  }
}
