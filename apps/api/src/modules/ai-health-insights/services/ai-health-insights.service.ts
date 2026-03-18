import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiHealthInsight, AiHealthInsightDocument, RiskLevel } from '../entities/ai-health-insight.entity';
import { CreateAiHealthInsightDto, UpdateAiHealthInsightDto, QueryAiHealthInsightDto } from '../dto/create-ai-health-insight.dto';

@Injectable()
export class AiHealthInsightsService {
  constructor(
    @InjectModel(AiHealthInsight.name) private insightModel: Model<AiHealthInsightDocument>,
  ) {}

  async create(createDto: CreateAiHealthInsightDto): Promise<AiHealthInsight> {
    const insightData = {
      patientId: new Types.ObjectId(createDto.userId || ''),
      analyzedMetrics: {},
      riskLevel: 'normal',
      advice: '',
    };
    
    const insight = await this.insightModel.create(insightData);
    return insight;
  }

  async findByPatientId(patientId: string, query?: QueryAiHealthInsightDto): Promise<AiHealthInsight[]> {
    const filter: Record<string, any> = { patientId: new Types.ObjectId(patientId) };
    
    if (query?.riskLevel) filter.riskLevel = query.riskLevel;

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

    if (query?.patientId) filter.patientId = new Types.ObjectId(query.patientId);
    if (query?.riskLevel) filter.riskLevel = query.riskLevel;

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

  async findByIdAndPatientId(insightId: string, patientId: string): Promise<AiHealthInsight> {
    const insight = await this.insightModel.findOne({
      _id: new Types.ObjectId(insightId),
      patientId: new Types.ObjectId(patientId),
    });
    if (!insight) {
      throw new NotFoundException(`AI Health Insight with ID ${insightId} not found for this patient`);
    }
    return insight;
  }

  async update(insightId: string, updateDto: UpdateAiHealthInsightDto): Promise<AiHealthInsight> {
    const updateData: any = { ...updateDto };

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

  async updateByIdAndPatientId(insightId: string, patientId: string, updateDto: UpdateAiHealthInsightDto): Promise<AiHealthInsight> {
    const updateData: any = { ...updateDto };

    const insight = await this.insightModel.findOneAndUpdate(
      { _id: new Types.ObjectId(insightId), patientId: new Types.ObjectId(patientId) },
      updateData,
      { new: true },
    );

    if (!insight) {
      throw new NotFoundException(`AI Health Insight with ID ${insightId} not found for this patient`);
    }

    return insight;
  }

  async acknowledgeInsight(insightId: string, patientId: string): Promise<AiHealthInsight> {
    const insight = await this.insightModel.findOne({
      _id: new Types.ObjectId(insightId),
      patientId: new Types.ObjectId(patientId),
    });

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

  async deleteByPatientId(patientId: string): Promise<{ deletedCount: number }> {
    const result = await this.insightModel.deleteMany({
      patientId: new Types.ObjectId(patientId),
    });

    return { deletedCount: result.deletedCount || 0 };
  }

  async getStatsByPatient(patientId: string): Promise<Record<string, any>> {
    const insights = await this.insightModel.find({
      patientId: new Types.ObjectId(patientId),
    });

    const stats = {
      total: insights.length,
      byRiskLevel: {} as Record<string, number>,
    };

    insights.forEach(insight => {
      stats.byRiskLevel[insight.riskLevel] = (stats.byRiskLevel[insight.riskLevel] || 0) + 1;
    });

    return stats;
  }
}
