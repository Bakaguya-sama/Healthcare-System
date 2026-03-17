import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiFeedback, AiFeedbackDocument } from './entities/ai-feedback.entity';
import { CreateAiFeedbackDto, UpdateAiFeedbackDto, QueryAiFeedbackDto } from './dto/create-ai-feedback.dto';

@Injectable()
export class AiFeedbacksService {
  constructor(
    @InjectModel(AiFeedback.name) private aiFeedbackModel: Model<AiFeedbackDocument>,
  ) {}

  async create(userId: string, createDto: CreateAiFeedbackDto): Promise<AiFeedback> {
    try {
      const feedback = new this.aiFeedbackModel({
        ...createDto,
        sessionId: new Types.ObjectId(createDto.sessionId),
        messageId: createDto.messageId ? new Types.ObjectId(createDto.messageId) : undefined,
        userId: new Types.ObjectId(userId),
        isVerified: false,
        helpfulCount: 0,
      });
      return await feedback.save();
    } catch (error) {
      throw new BadRequestException(`Failed to create AI feedback: ${error.message}`);
    }
  }

  async findByUserId(userId: string, query: QueryAiFeedbackDto): Promise<{ data: AiFeedback[]; total: number }> {
    const { page = 1, limit = 10, sessionId, feedbackType, minRating, maxRating, isVerified, sortBy = 'createdAt', sortOrder = -1 } = query;

    const filter: any = { userId: new Types.ObjectId(userId) };

    if (sessionId) filter.sessionId = new Types.ObjectId(sessionId);
    if (feedbackType) filter.feedbackType = feedbackType;
    if (isVerified !== undefined) filter.isVerified = isVerified;

    if (minRating !== undefined || maxRating !== undefined) {
      filter.rating = {};
      if (minRating !== undefined) filter.rating.$gte = minRating;
      if (maxRating !== undefined) filter.rating.$lte = maxRating;
    }

    const skip = (page - 1) * limit;
    const data = await this.aiFeedbackModel
      .find(filter)
      .sort({ [sortBy]: sortOrder as any })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.aiFeedbackModel.countDocuments(filter);

    return { data, total };
  }

  async findBySessionId(sessionId: string, query: QueryAiFeedbackDto): Promise<{ data: AiFeedback[]; total: number }> {
    const { page = 1, limit = 10, feedbackType, minRating, maxRating, isVerified, sortBy = 'createdAt', sortOrder = -1 } = query;

    const filter: any = { sessionId: new Types.ObjectId(sessionId) };

    if (feedbackType) filter.feedbackType = feedbackType;
    if (isVerified !== undefined) filter.isVerified = isVerified;

    if (minRating !== undefined || maxRating !== undefined) {
      filter.rating = {};
      if (minRating !== undefined) filter.rating.$gte = minRating;
      if (maxRating !== undefined) filter.rating.$lte = maxRating;
    }

    const skip = (page - 1) * limit;
    const data = await this.aiFeedbackModel
      .find(filter)
      .sort({ [sortBy]: sortOrder as any })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.aiFeedbackModel.countDocuments(filter);

    return { data, total };
  }

  async findAll(query: QueryAiFeedbackDto): Promise<{ data: AiFeedback[]; total: number }> {
    const { page = 1, limit = 10, feedbackType, minRating, maxRating, isVerified, sortBy = 'createdAt', sortOrder = -1 } = query;

    const filter: any = {};

    if (feedbackType) filter.feedbackType = feedbackType;
    if (isVerified !== undefined) filter.isVerified = isVerified;

    if (minRating !== undefined || maxRating !== undefined) {
      filter.rating = {};
      if (minRating !== undefined) filter.rating.$gte = minRating;
      if (maxRating !== undefined) filter.rating.$lte = maxRating;
    }

    const skip = (page - 1) * limit;
    const data = await this.aiFeedbackModel
      .find(filter)
      .sort({ [sortBy]: sortOrder as any })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.aiFeedbackModel.countDocuments(filter);

    return { data, total };
  }

  async findById(feedbackId: string): Promise<AiFeedback> {
    const feedback = await this.aiFeedbackModel.findById(new Types.ObjectId(feedbackId)).exec();
    if (!feedback) {
      throw new NotFoundException(`AI Feedback with ID ${feedbackId} not found`);
    }
    return feedback;
  }

  async findByIdAndUserId(feedbackId: string, userId: string): Promise<AiFeedback> {
    const feedback = await this.aiFeedbackModel
      .findOne({
        _id: new Types.ObjectId(feedbackId),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (!feedback) {
      throw new NotFoundException(`AI Feedback with ID ${feedbackId} not found or access denied`);
    }
    return feedback;
  }

  async update(feedbackId: string, userId: string, updateDto: UpdateAiFeedbackDto): Promise<AiFeedback> {
    const feedback = await this.findByIdAndUserId(feedbackId, userId);

    Object.assign(feedback, updateDto);
    return await feedback.save();
  }

  async markHelpful(feedbackId: string): Promise<AiFeedback> {
    const feedback = await this.aiFeedbackModel.findByIdAndUpdate(
      new Types.ObjectId(feedbackId),
      {
        $inc: { helpfulCount: 1 },
      },
      { new: true },
    );

    if (!feedback) {
      throw new NotFoundException(`AI Feedback with ID ${feedbackId} not found`);
    }
    return feedback;
  }

  async verifyFeedback(feedbackId: string): Promise<AiFeedback> {
    const feedback = await this.aiFeedbackModel.findByIdAndUpdate(
      new Types.ObjectId(feedbackId),
      {
        isVerified: true,
      },
      { new: true },
    );

    if (!feedback) {
      throw new NotFoundException(`AI Feedback with ID ${feedbackId} not found`);
    }
    return feedback;
  }

  async getAverageRating(sessionId: string): Promise<{ averageRating: number; totalFeedbacks: number }> {
    const feedbacks = await this.aiFeedbackModel
      .find({ sessionId: new Types.ObjectId(sessionId) })
      .exec();

    if (feedbacks.length === 0) {
      return { averageRating: 0, totalFeedbacks: 0 };
    }

    const averageRating = feedbacks.reduce((sum, fb) => sum + fb.rating, 0) / feedbacks.length;

    return {
      averageRating: Math.round(averageRating * 100) / 100,
      totalFeedbacks: feedbacks.length,
    };
  }

  async delete(feedbackId: string, userId: string): Promise<AiFeedback> {
    const feedback = await this.aiFeedbackModel.findOneAndDelete({
      _id: new Types.ObjectId(feedbackId),
      userId: new Types.ObjectId(userId),
    });

    if (!feedback) {
      throw new NotFoundException(`AI Feedback with ID ${feedbackId} not found or access denied`);
    }
    return feedback;
  }

  async deleteById(feedbackId: string): Promise<AiFeedback> {
    const feedback = await this.aiFeedbackModel.findByIdAndDelete(new Types.ObjectId(feedbackId));

    if (!feedback) {
      throw new NotFoundException(`AI Feedback with ID ${feedbackId} not found`);
    }
    return feedback;
  }

  async deleteBySessionId(sessionId: string): Promise<{ deletedCount: number }> {
    const result = await this.aiFeedbackModel.deleteMany({
      sessionId: new Types.ObjectId(sessionId),
    });

    return { deletedCount: result.deletedCount };
  }
}
