import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiHealthInsight, AiHealthInsightDocument, InsightType, ConfidenceLevel } from '../entities/ai-health-insight.entity';
import { CreateAiHealthInsightDto, UpdateAiHealthInsightDto, QueryAiHealthInsightDto } from '../dto/create-ai-health-insight.dto';

@Injectable()
export class AiHealthInsightsService {
  constructor(
    @InjectModel(AiHealthInsight.name) private insightModel: Model<AiHealthInsightDocument>,
  ) {}

  async create(createDto: CreateAiHealthInsightDto): Promise<AiHealthInsight> {
    const insightData = {
      ...createDto,
      userId: new Types.ObjectId(createDto.userId),
      relatedMetrics: createDto.relatedMetrics?.map(id => new Types.ObjectId(id)) || [],
      metadata: createDto.metadata || {},
    };
    
    const insight = await this.insightModel.create(insightData);
    return insight;
  }

  async findByUserId(userId: string, query?: QueryAiHealthInsightDto): Promise<AiHealthInsight[]> {
    const filter: Record<string, any> = { userId: new Types.ObjectId(userId) };
    
    if (query?.insightType) filter.insightType = query.insightType;
    if (query?.metricType) filter.metricType = query.metricType;
    if (query?.confidenceLevel) filter.confidenceLevel = query.confidenceLevel;
    if (query?.notified !== undefined) filter.notified = query.notified;
    if (query?.acknowledged !== undefined) filter.acknowledged = query.acknowledged;

    let queryBuilder = this.insightModel.find(filter);

    if (query?.sortBy) {
      queryBuilder = queryBuilder.sort({ [query.sortBy]: query?.sortOrder === 'asc' ? 1 : -1 } as any);
    } else {
      queryBuilder = queryBuilder.sort({ createdAt: -1 } as any);
    }

    if (query?.page && query?.limit) {
      const skip = (query.page - 1) * query.limit;
      queryBuilder = queryBuilder.skip(skip).limit(query.limit);
    }

    return queryBuilder.exec();
  }

  async findAll(query?: QueryAiHealthInsightDto): Promise<AiHealthInsight[]> {
    const filter: Record<string, any> = {};

    if (query?.userId) filter.userId = new Types.ObjectId(query.userId);
    if (query?.insightType) filter.insightType = query.insightType;
    if (query?.metricType) filter.metricType = query.metricType;
    if (query?.confidenceLevel) filter.confidenceLevel = query.confidenceLevel;
    if (query?.notified !== undefined) filter.notified = query.notified;
    if (query?.acknowledged !== undefined) filter.acknowledged = query.acknowledged;

    let queryBuilder = this.insightModel.find(filter);

    if (query?.sortBy) {
      queryBuilder = queryBuilder.sort({ [query.sortBy]: query?.sortOrder === 'asc' ? 1 : -1 } as any);
    } else {
      queryBuilder = queryBuilder.sort({ createdAt: -1 } as any);
    }

    if (query?.page && query?.limit) {
      const skip = (query.page - 1) * query.limit;
      queryBuilder = queryBuilder.skip(skip).limit(query.limit);
    }

    return queryBuilder.exec();
  }

  async findById(insightId: string): Promise<AiHealthInsight> {
    const insight = await this.insightModel.findById(new Types.ObjectId(insightId));
    if (!insight) {
      throw new NotFoundException(`AI Health Insight with ID ${insightId} not found`);
    }
    return insight;
  }

  async findByIdAndUserId(insightId: string, userId: string): Promise<AiHealthInsight> {
    const insight = await this.insightModel.findOne({
      _id: new Types.ObjectId(insightId),
      userId: new Types.ObjectId(userId),
    });
    if (!insight) {
      throw new NotFoundException(`AI Health Insight with ID ${insightId} not found for this user`);
    }
    return insight;
  }

  async update(insightId: string, updateDto: UpdateAiHealthInsightDto): Promise<AiHealthInsight> {
    const updateData: any = { ...updateDto };

    if (updateDto.relatedMetrics) {
      updateData.relatedMetrics = updateDto.relatedMetrics.map(id => new Types.ObjectId(id));
    }

    if (updateDto.acknowledged === true && !updateData.acknowledgedAt) {
      updateData.acknowledgedAt = new Date();
    }

    const insight = await this.insightModel.findByIdAndUpdate(
      new Types.ObjectId(insightId),
      updateData,
      { new: true },
    );

    if (!insight) {
      throw new NotFoundException(`AI Health Insight with ID ${insightId} not found`);
    }

    return insight;
  }

  async updateByIdAndUserId(insightId: string, userId: string, updateDto: UpdateAiHealthInsightDto): Promise<AiHealthInsight> {
    const updateData: any = { ...updateDto };

    if (updateDto.relatedMetrics) {
      updateData.relatedMetrics = updateDto.relatedMetrics.map(id => new Types.ObjectId(id));
    }

    if (updateDto.acknowledged === true && !updateData.acknowledgedAt) {
      updateData.acknowledgedAt = new Date();
    }

    const insight = await this.insightModel.findOneAndUpdate(
      { _id: new Types.ObjectId(insightId), userId: new Types.ObjectId(userId) },
      updateData,
      { new: true },
    );

    if (!insight) {
      throw new NotFoundException(`AI Health Insight with ID ${insightId} not found for this user`);
    }

    return insight;
  }

  async acknowledgeInsight(insightId: string, userId: string): Promise<AiHealthInsight> {
    const insight = await this.insightModel.findOneAndUpdate(
      { _id: new Types.ObjectId(insightId), userId: new Types.ObjectId(userId) },
      { acknowledged: true, acknowledgedAt: new Date() },
      { new: true },
    );

    if (!insight) {
      throw new NotFoundException(`AI Health Insight with ID ${insightId} not found`);
    }

    return insight;
  }

  async searchByType(insightType: InsightType, query?: QueryAiHealthInsightDto): Promise<AiHealthInsight[]> {
    const filter: Record<string, any> = { insightType };

    if (query?.userId) filter.userId = new Types.ObjectId(query.userId);
    if (query?.confidenceLevel) filter.confidenceLevel = query.confidenceLevel;

    let queryBuilder = this.insightModel.find(filter);

    if (query?.sortBy) {
      queryBuilder = queryBuilder.sort({ [query.sortBy]: query?.sortOrder === 'asc' ? 1 : -1 } as any);
    } else {
      queryBuilder = queryBuilder.sort({ createdAt: -1 } as any);
    }

    if (query?.page && query?.limit) {
      const skip = (query.page - 1) * query.limit;
      queryBuilder = queryBuilder.skip(skip).limit(query.limit);
    }

    return queryBuilder.exec();
  }

  async searchByConfidence(confidenceLevel: ConfidenceLevel, query?: QueryAiHealthInsightDto): Promise<AiHealthInsight[]> {
    const filter: Record<string, any> = { confidenceLevel };

    if (query?.userId) filter.userId = new Types.ObjectId(query.userId);
    if (query?.insightType) filter.insightType = query.insightType;

    let queryBuilder = this.insightModel.find(filter);

    if (query?.sortBy) {
      queryBuilder = queryBuilder.sort({ [query.sortBy]: query?.sortOrder === 'asc' ? 1 : -1 } as any);
    } else {
      queryBuilder = queryBuilder.sort({ createdAt: -1 } as any);
    }

    if (query?.page && query?.limit) {
      const skip = (query.page - 1) * query.limit;
      queryBuilder = queryBuilder.skip(skip).limit(query.limit);
    }

    return queryBuilder.exec();
  }

  async getPendingNotifications(userId: string): Promise<AiHealthInsight[]> {
    return this.insightModel
      .find({
        userId: new Types.ObjectId(userId),
        notified: false,
      })
      .sort({ createdAt: -1 } as any)
      .exec();
  }

  async markAsNotified(insightId: string): Promise<AiHealthInsight> {
    const insight = await this.insightModel.findByIdAndUpdate(
      new Types.ObjectId(insightId),
      { notified: true },
      { new: true },
    );

    if (!insight) {
      throw new NotFoundException(`AI Health Insight with ID ${insightId} not found`);
    }

    return insight;
  }

  async delete(insightId: string): Promise<AiHealthInsight> {
    const insight = await this.insightModel.findByIdAndDelete(new Types.ObjectId(insightId));
    
    if (!insight) {
      throw new NotFoundException(`AI Health Insight with ID ${insightId} not found`);
    }

    return insight;
  }

  async deleteByUserId(userId: string): Promise<{ deletedCount: number }> {
    const result = await this.insightModel.deleteMany({
      userId: new Types.ObjectId(userId),
    });

    return { deletedCount: result.deletedCount || 0 };
  }

  async getStatsByUser(userId: string): Promise<Record<string, any>> {
    const insights = await this.insightModel.find({
      userId: new Types.ObjectId(userId),
    });

    const stats = {
      total: insights.length,
      byType: {} as Record<string, number>,
      byConfidence: {} as Record<string, number>,
      acknowledged: insights.filter(i => i.acknowledged).length,
      notified: insights.filter(i => i.notified).length,
      unacknowledged: insights.filter(i => !i.acknowledged).length,
    };

    insights.forEach(insight => {
      stats.byType[insight.insightType] = (stats.byType[insight.insightType] || 0) + 1;
      stats.byConfidence[insight.confidenceLevel] = (stats.byConfidence[insight.confidenceLevel] || 0) + 1;
    });

    return stats;
  }
}
