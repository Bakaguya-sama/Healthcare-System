import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  HealthMetric,
  HealthMetricDocument,
} from './entities/health-metric.entity';
import { CreateHealthMetricDto } from './dto/create-health-metric.dto';

@Injectable()
export class HealthMetricsService {
  constructor(
    @InjectModel(HealthMetric.name)
    private healthMetricModel: Model<HealthMetricDocument>,
  ) {}

  async create(userId: string, dto: CreateHealthMetricDto) {
    return this.healthMetricModel.create({ ...dto, userId });
  }

  async findByUser(userId: string, type?: string) {
    const filter: Record<string, unknown> = { userId };
    if (type) filter.type = type;
    return this.healthMetricModel.find(filter).sort({ recordedAt: -1 });
  }

  async findLatestByType(userId: string) {
    const types = [
      'blood_pressure',
      'heart_rate',
      'blood_sugar',
      'weight',
      'bmi',
    ];
    const results = await Promise.all(
      types.map((type) =>
        this.healthMetricModel
          .findOne({ userId, type })
          .sort({ recordedAt: -1 }),
      ),
    );
    return types.reduce(
      (acc, type, i) => ({ ...acc, [type]: results[i] }),
      {} as Record<string, HealthMetricDocument | null>,
    );
  }

  async delete(id: string, userId: string) {
    const metric = await this.healthMetricModel.findOneAndDelete({
      _id: id,
      userId,
    });
    if (!metric) throw new NotFoundException('Health metric not found');
    return { message: 'Deleted successfully' };
  }
}
