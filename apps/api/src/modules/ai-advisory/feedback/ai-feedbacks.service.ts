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

const AI_FEEDBACK_READ_PROJECTION =
  '_id aiConversationId patientId content createdAt updatedAt';

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
        aiConversationId: new Types.ObjectId(createDto.aiConversationId),
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
      aiConversationId,
      sortBy = 'createdAt',
      sortOrder = -1,
    } = query;

    const filter: any = { patientId: new Types.ObjectId(patientId) };

    if (aiConversationId)
      filter.aiConversationId = new Types.ObjectId(aiConversationId);

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.aiFeedbackModel
        .find(filter)
        .select(AI_FEEDBACK_READ_PROJECTION)
        .sort({ [sortBy]: sortOrder as any, _id: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean<AiFeedback[]>()
        .exec(),
      this.aiFeedbackModel.countDocuments(filter),
    ]);

    return { data, total };
  }

  async findByConversationId(
    aiConversationId: string,
    query: QueryAiFeedbackDto,
  ): Promise<{ data: AiFeedback[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = -1,
    } = query;

    const filter: any = {
      aiConversationId: new Types.ObjectId(aiConversationId),
    };

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.aiFeedbackModel
        .find(filter)
        .select(AI_FEEDBACK_READ_PROJECTION)
        .sort({ [sortBy]: sortOrder as any, _id: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean<AiFeedback[]>()
        .exec(),
      this.aiFeedbackModel.countDocuments(filter),
    ]);

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
    const [data, total] = await Promise.all([
      this.aiFeedbackModel
        .find(filter)
        .select(AI_FEEDBACK_READ_PROJECTION)
        .sort({ [sortBy]: sortOrder as any, _id: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean<AiFeedback[]>()
        .exec(),
      this.aiFeedbackModel.countDocuments(filter),
    ]);

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

  async getFeedbackCount(
    conversationId: string,
  ): Promise<{ totalFeedbacks: number }> {
    const totalFeedbacks = await this.aiFeedbackModel.countDocuments({
      aiConversationId: new Types.ObjectId(conversationId),
    });

    return { totalFeedbacks };
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

  async deleteByConversationId(
    conversationId: string,
  ): Promise<{ deletedCount: number }> {
    const result = await this.aiFeedbackModel.deleteMany({
      aiConversationId: new Types.ObjectId(conversationId),
    });

    return { deletedCount: result.deletedCount };
  }
}
