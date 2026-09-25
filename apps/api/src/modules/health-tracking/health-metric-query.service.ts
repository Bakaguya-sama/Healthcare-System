import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
} from '../../common/pagination';
import { QueryHealthMetricDto } from './dto/query-health-metric.dto';
import {
  HealthMetric,
  HealthMetricDocument,
  MetricType,
} from './entities/health-metric.entity';
import type {
  HealthProfileMetric,
  HealthProfileReader,
} from './ports/health-profile-reader';

type MetricEntry = {
  value: number;
  recordedAt: Date | string;
};

type HealthMetricStatisticsAggregation = {
  stats: Array<{ count: number }>;
  numericStats: Array<{
    average: number;
    minimum: number;
    maximum: number;
  }>;
  latest: Array<{
    _id: Types.ObjectId;
    patientId: Types.ObjectId;
    type: MetricType;
    values: Record<string, MetricEntry>;
    unit: string;
    recordedAt: Date;
    createdAt?: Date;
    updatedAt?: Date;
  }>;
};

const HEALTH_METRIC_READ_PROJECTION =
  '_id patientId type values unit recordedAt createdAt updatedAt source timezone';

const PRIMARY_VALUE_KEY_BY_TYPE: Record<MetricType, string> = {
  [MetricType.BLOOD_PRESSURE]: 'systolic',
  [MetricType.HEART_RATE]: 'value',
  [MetricType.BLOOD_GLUCOSE]: 'value',
  [MetricType.OXYGEN_SATURATION]: 'value',
  [MetricType.BODY_TEMPERATURE]: 'value',
  [MetricType.RESPIRATORY_RATE]: 'value',
  [MetricType.BMI]: 'value',
  [MetricType.WEIGHT]: 'value',
  [MetricType.HEIGHT]: 'value',
  [MetricType.WATER_INTAKE]: 'amount',
  [MetricType.KCAL_INTAKE]: 'amount',
};

@Injectable()
export class HealthMetricQueryService implements HealthProfileReader {
  constructor(
    @InjectModel(HealthMetric.name)
    private readonly healthMetricModel: Model<HealthMetricDocument>,
  ) {}

  async readRecentMetrics(
    patientId: string,
    limit = 20,
  ): Promise<HealthProfileMetric[]> {
    if (!Types.ObjectId.isValid(patientId))
      throw new BadRequestException('Invalid patient ID');
    const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    return this.healthMetricModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .select('_id type values unit source timezone recordedAt')
      .sort({ recordedAt: -1, _id: -1 })
      .limit(boundedLimit)
      .lean<HealthProfileMetric[]>()
      .exec();
  }

  async findAll(
    userId: string,
    userRole: string | undefined,
    query: QueryHealthMetricDto,
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    let patientId = userId;
    if (query.patientId) {
      if (!Types.ObjectId.isValid(query.patientId)) {
        throw new BadRequestException('Invalid patient ID');
      }

      if (userRole !== 'doctor' && userRole !== 'admin') {
        throw new BadRequestException('Not allowed to view patient metrics');
      }

      patientId = query.patientId;
    }

    const filter: {
      patientId: Types.ObjectId;
      type?: MetricType;
      recordedAt?: {
        $gte?: Date;
        $lte?: Date;
      };
    } = {
      patientId: new Types.ObjectId(patientId),
    };

    // Apply filters
    if (query.type) {
      filter.type = query.type;
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
    const cursorFilter: Record<string, unknown> = { ...filter };
    const sortField = query.sortBy || 'recordedAt';
    const sortOrder = query.sortOrder || -1;
    if (query.cursor) {
      try {
        const cursor = decodeCursor(query.cursor);
        const cursorDate = new Date(cursor.sortValue);
        if (Number.isNaN(cursorDate.getTime())) throw new InvalidCursorError();
        const comparator = sortOrder === 1 ? '$gt' : '$lt';
        cursorFilter.$or = [
          { [sortField]: { [comparator]: cursorDate } },
          {
            [sortField]: cursorDate,
            _id: { [comparator]: new Types.ObjectId(cursor.id) },
          },
        ];
      } catch (error) {
        if (error instanceof InvalidCursorError)
          throw new BadRequestException('Invalid metric cursor');
        throw error;
      }
    }
    const skip = query.cursor ? 0 : (query.page - 1) * query.limit;
    const sort = {
      [sortField]: sortOrder,
      _id: sortOrder,
    };

    // Execute query
    const [data, total] = await Promise.all([
      this.healthMetricModel
        .find(cursorFilter)
        .select(HEALTH_METRIC_READ_PROJECTION)
        .sort(sort)
        .skip(skip)
        .limit(query.limit + 1)
        .lean()
        .exec(),
      this.healthMetricModel.countDocuments(filter),
    ]);
    const hasNextPage = data.length > query.limit;
    const items = hasNextPage ? data.slice(0, query.limit) : data;
    const last = items.at(-1) as
      | { recordedAt?: Date; createdAt?: Date; _id?: Types.ObjectId }
      | undefined;
    const lastSortValue = last?.[sortField];

    return {
      statusCode: 200,
      message: 'Health metrics retrieved successfully',
      data: items,
      nextCursor:
        hasNextPage && lastSortValue && last?._id
          ? encodeCursor({
              sortValue: lastSortValue.toISOString(),
              id: String(last._id),
            })
          : null,
      hasNextPage,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid metric ID');
    }

    const metric = await this.healthMetricModel
      .findOne({
        _id: new Types.ObjectId(id),
        patientId: new Types.ObjectId(userId),
      })
      .select(HEALTH_METRIC_READ_PROJECTION)
      .lean()
      .exec();

    if (!metric) {
      throw new NotFoundException('Health metric not found');
    }

    return {
      statusCode: 200,
      message: 'Health metric retrieved successfully',
      data: metric,
    };
  }

  async getStatistics(
    userId: string,
    type: string,
    query?: QueryHealthMetricDto,
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    if (!Object.values(MetricType).includes(type as MetricType)) {
      throw new BadRequestException('Invalid metric type');
    }

    const metricType = type as MetricType;
    const primaryValueKey = PRIMARY_VALUE_KEY_BY_TYPE[metricType];
    const statisticsMatch: Record<string, unknown> = {
      patientId: new Types.ObjectId(userId),
      type: metricType,
    };
    const endDate = query?.endDate ? new Date(query.endDate) : new Date();
    const startDate = query?.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate > endDate
    ) {
      throw new BadRequestException('Invalid statistics date range');
    }
    if (endDate.getTime() - startDate.getTime() > 366 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(
        'Statistics date range must not exceed 366 days',
      );
    }
    statisticsMatch.recordedAt = { $gte: startDate, $lte: endDate };
    const [result] =
      await this.healthMetricModel.aggregate<HealthMetricStatisticsAggregation>(
        [
          {
            $match: statisticsMatch,
          },
          { $sort: { recordedAt: -1, _id: -1 } },
          {
            $facet: {
              stats: [{ $count: 'count' }],
              numericStats: [
                {
                  $project: {
                    numericValue: `$values.${primaryValueKey}.value`,
                  },
                },
                {
                  $match: {
                    numericValue: { $type: 'number', $gt: 0 },
                  },
                },
                {
                  $group: {
                    _id: null,
                    average: { $avg: '$numericValue' },
                    minimum: { $min: '$numericValue' },
                    maximum: { $max: '$numericValue' },
                  },
                },
                { $project: { _id: 0 } },
              ],
              latest: [
                { $limit: 1 },
                {
                  $project: {
                    _id: 1,
                    patientId: 1,
                    type: 1,
                    values: 1,
                    unit: 1,
                    recordedAt: 1,
                    createdAt: 1,
                    updatedAt: 1,
                  },
                },
              ],
            },
          },
        ],
      );

    if (!result?.latest.length) {
      throw new NotFoundException('No metrics found for this type');
    }

    const stats = result.numericStats[0];
    if (!stats) {
      throw new BadRequestException('No numeric values found in metrics');
    }

    return {
      statusCode: 200,
      message: 'Statistics retrieved successfully',
      data: {
        type: metricType,
        count: result.stats[0].count,
        average: Math.round(stats.average * 100) / 100,
        minimum: stats.minimum,
        maximum: stats.maximum,
        latest: result.latest[0],
      },
    };
  }
}
