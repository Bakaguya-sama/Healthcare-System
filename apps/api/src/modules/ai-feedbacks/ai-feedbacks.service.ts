import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiFeedback, AiFeedbackDocument } from './entities/ai-feedback.entity';
import {
  CreateAiFeedbackDto,
  UpdateAiFeedbackDto,
  QueryAiFeedbackDto,
} from './dto/create-ai-feedback.dto';

@Injectable()
export class AiFeedbacksService {
  constructor(
    @InjectModel(AiFeedback.name)
    private aiFeedbackModel: Model<AiFeedbackDocument>,
  ) {}

  async create(
    patientId: string,
    createDto: CreateAiFeedbackDto,
  ): Promise<AiFeedback> {
    try {
      const feedback = new this.aiFeedbackModel({
        ...createDto,
        patientId: new Types.ObjectId(patientId),
        aiSessionId: new Types.ObjectId(createDto.aiSessionId),
      });
      return await feedback.save();
    } catch (error) {
      throw new BadRequestException(
        `Failed to create AI feedback: ${error.message}`,
      );
    }
  }

  async findByPatientId(
    patientId: string,
    query: QueryAiFeedbackDto,
  ): Promise<{ data: AiFeedback[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      aiSessionId,
      sortBy = 'createdAt',
      sortOrder = -1,
    } = query;

    const filter: any = { patientId: new Types.ObjectId(patientId) };

    if (aiSessionId) filter.aiSessionId = new Types.ObjectId(aiSessionId);

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

  async findBySessionId(
    aiSessionId: string,
    query: QueryAiFeedbackDto,
  ): Promise<{ data: AiFeedback[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = -1,
    } = query;

    const filter: any = { aiSessionId: new Types.ObjectId(aiSessionId) };

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

  async findAll(
    query: QueryAiFeedbackDto,
  ): Promise<{ data: AiFeedback[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = -1,
    } = query;

    const filter: any = {};

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
    const feedback = await this.aiFeedbackModel
      .findById(new Types.ObjectId(feedbackId))
      .exec();
    if (!feedback) {
      throw new NotFoundException(
        `AI Feedback with ID ${feedbackId} not found`,
      );
    }
    return feedback;
  }

  async findByIdAndUserId(
    feedbackId: string,
    userId: string,
  ): Promise<AiFeedback> {
    const feedback = await this.aiFeedbackModel
      .findOne({
        _id: new Types.ObjectId(feedbackId),
        patientId: new Types.ObjectId(userId),
      })
      .exec();

    if (!feedback) {
      throw new NotFoundException(
        `AI Feedback with ID ${feedbackId} not found or access denied`,
      );
    }
    return feedback;
  }

  async update(
    feedbackId: string,
    userId: string,
    updateDto: UpdateAiFeedbackDto,
  ): Promise<AiFeedback> {
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
      throw new NotFoundException(
        `AI Feedback with ID ${feedbackId} not found`,
      );
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
      throw new NotFoundException(
        `AI Feedback with ID ${feedbackId} not found`,
      );
    }
    return feedback;
  }

  async getAverageRating(
    sessionId: string,
  ): Promise<{ totalFeedbacks: number }> {
    const feedbacks = await this.aiFeedbackModel
      .find({ aiSessionId: new Types.ObjectId(sessionId) })
      .exec();

    if (feedbacks.length === 0) {
      return { totalFeedbacks: 0 };
    }

    return {
      totalFeedbacks: feedbacks.length,
    };
  }

  async delete(feedbackId: string, userId: string): Promise<AiFeedback> {
    const feedback = await this.aiFeedbackModel.findOneAndDelete({
      _id: new Types.ObjectId(feedbackId),
      patientId: new Types.ObjectId(userId),
    });

    if (!feedback) {
      throw new NotFoundException(
        `AI Feedback with ID ${feedbackId} not found or access denied`,
      );
    }
    return feedback;
  }

  async deleteById(feedbackId: string): Promise<AiFeedback> {
    const feedback = await this.aiFeedbackModel.findByIdAndDelete(
      new Types.ObjectId(feedbackId),
    );

    if (!feedback) {
      throw new NotFoundException(
        `AI Feedback with ID ${feedbackId} not found`,
      );
    }
    return feedback;
  }

  async deleteBySessionId(
    sessionId: string,
  ): Promise<{ deletedCount: number }> {
    const result = await this.aiFeedbackModel.deleteMany({
      aiSessionId: new Types.ObjectId(sessionId),
    });

    return { deletedCount: result.deletedCount };
  }
}
