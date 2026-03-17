import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  HealthMetric,
  HealthMetricDocument,
} from './entities/health-metric.entity';
import { CreateHealthMetricDto } from './dto/create-health-metric.dto';
import { UpdateHealthMetricDto } from './dto/update-health-metric.dto';
import { QueryHealthMetricDto } from './dto/query-health-metric.dto';

@Injectable()
export class HealthMetricsService {
  constructor(
    @InjectModel(HealthMetric.name)
    private healthMetricModel: Model<HealthMetricDocument>,
  ) {}

  /**
   * 📝 TẠO HEALTH METRIC MỚI
   */
  async create(userId: string, dto: CreateHealthMetricDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const metric = await this.healthMetricModel.create({
      userId: new Types.ObjectId(userId),
      type: dto.type,
      values: dto.values,
      unit: dto.unit,
      status: dto.status || 'normal',
      note: dto.note,
      recordedAt: dto.recordedAt || new Date(),
      doctor: dto.doctor,
    });

    return {
      statusCode: 201,
      message: 'Health metric recorded successfully',
      data: metric,
    };
  }

  /**
   * 📊 LẤY TẤT CẢ METRICS CỦA USER
   */
  async findAll(userId: string, query: QueryHealthMetricDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const filter: any = { userId: new Types.ObjectId(userId) };

    // Apply filters
    if (query.type) {
      filter.type = query.type;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.startDate || query.endDate) {
      filter.recordedAt = {};
      if (query.startDate) {
        filter.recordedAt.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        filter.recordedAt.$lte = new Date(query.endDate);
      }
    }

    // Calculate pagination
    const skip = (query.page - 1) * query.limit;
    const sort = {
      [query.sortBy || 'recordedAt']: query.sortOrder || -1,
    };

    // Execute query
    const [data, total] = await Promise.all([
      this.healthMetricModel.find(filter).sort(sort).skip(skip).limit(query.limit),
      this.healthMetricModel.countDocuments(filter),
    ]);

    return {
      statusCode: 200,
      message: 'Health metrics retrieved successfully',
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * 🔍 LẤY 1 METRIC
   */
  async findOne(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid metric ID');
    }

    const metric = await this.healthMetricModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });

    if (!metric) {
      throw new NotFoundException('Health metric not found');
    }

    return {
      statusCode: 200,
      message: 'Health metric retrieved successfully',
      data: metric,
    };
  }

  /**
   * ✏️ CẬP NHẬT METRIC
   */
  async update(
    userId: string,
    id: string,
    dto: UpdateHealthMetricDto,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid metric ID');
    }

    const metric = await this.healthMetricModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });

    if (!metric) {
      throw new NotFoundException('Health metric not found');
    }

    // Update fields
    Object.assign(metric, dto);
    await metric.save();

    return {
      statusCode: 200,
      message: 'Health metric updated successfully',
      data: metric,
    };
  }

  /**
   * 🗑️ XÓA METRIC
   */
  async remove(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid metric ID');
    }

    const result = await this.healthMetricModel.findOneAndDelete({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });

    if (!result) {
      throw new NotFoundException('Health metric not found');
    }

    return {
      statusCode: 200,
      message: 'Health metric deleted successfully',
    };
  }

  /**
   * 📈 LẤY STATISTICS
   */
  async getStatistics(userId: string, type: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const metrics = await this.healthMetricModel.find({
      userId: new Types.ObjectId(userId),
      type,
    });

    if (metrics.length === 0) {
      throw new NotFoundException('No metrics found for this type');
    }

    // Extract numeric values from flexible values object
    const values = metrics
      .map((m) => {
        // Get primary numeric value from values object
        if (m.values.value !== undefined) return m.values.value;
        if (m.values.systolic !== undefined) return m.values.systolic;
        if (m.values.amount !== undefined) return m.values.amount;
        // Fallback to any numeric property
        for (const [_, v] of Object.entries(m.values)) {
          if (typeof v === 'number') return v;
        }
        return 0;
      })
      .filter((v) => v > 0);

    if (values.length === 0) {
      throw new BadRequestException('No numeric values found in metrics');
    }

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const latest = metrics[metrics.length - 1];

    return {
      statusCode: 200,
      message: 'Statistics retrieved successfully',
      data: {
        type,
        count: metrics.length,
        average: Math.round(avg * 100) / 100,
        minimum: min,
        maximum: max,
        latest,
      },
    };
  }

  /**
   * 🔴 LẤY ALERT METRICS
   */
  async getAlerts(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const alerts = await this.healthMetricModel
      .find({
        userId: new Types.ObjectId(userId),
        isAlert: true,
      })
      .sort({ recordedAt: -1 })
      .limit(20);

    return {
      statusCode: 200,
      message: 'Alerts retrieved successfully',
      data: alerts,
      count: alerts.length,
    };
  }

  /**
   * ✅ MARK AS REVIEWED
   */
  async markAsReviewed(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid metric ID');
    }

    const metric = await this.healthMetricModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      },
      { isAlert: false },
      { new: true },
    );

    if (!metric) {
      throw new NotFoundException('Health metric not found');
    }

    return {
      statusCode: 200,
      message: 'Metric marked as reviewed',
      data: metric,
    };
  }
}
