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
} from '../../../../common/pagination';
import {
  HealthMetric,
  HealthMetricDocument,
  HealthMetricValidationStatus,
  MetricType,
} from '../../domain/entities/health-metric.entity';
import { QueryHealthMetricDto } from '../../presentation/dto/query-health-metric.dto';
import type {
  HealthMetricPort,
  HealthMetricReportItem,
} from '../ports/health-metric.port';
import type {
  HealthProfileMetric,
  HealthProfilePort,
} from '../ports/health-profile.port';

type HealthMetricReadRow = HealthMetric & { _id: Types.ObjectId };

type HealthMetricStatisticsAggregation = {
  stats: Array<{ count: number }>;
  numericStats: Array<{
    average: number;
    minimum: number;
    maximum: number;
  }>;
  latest: HealthMetricReadRow[];
};

const HEALTH_METRIC_READ_PROJECTION =
  '_id meta values source sourceRef validationStatus validationReasonCodes recordedTimezone replacesMetricId recordedAt ingestedAt voidedAt voidReason createdAt';

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
const METRIC_TYPE_VALUES: readonly string[] = Object.values(MetricType);

@Injectable()
export class HealthMetricQueryService
  implements HealthProfilePort, HealthMetricPort
{
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
    const rows = await this.healthMetricModel
      .find({
        'meta.patientId': new Types.ObjectId(patientId),
        validationStatus: HealthMetricValidationStatus.VALID,
      })
      .select(HEALTH_METRIC_READ_PROJECTION)
      .sort({ recordedAt: -1, _id: -1 })
      .limit(Math.max(1, Math.min(100, Math.floor(limit))))
      .lean()
      .exec();
    return rows.map((row) => ({
      metricType: row.meta.metricType,
      values: row.values,
      unit: row.meta.unit,
      source: row.source,
      recordedTimezone: row.recordedTimezone,
      recordedAt: row.recordedAt,
    }));
  }

  async findFirstRecordedInWindow(input: {
    patientId: string;
    metricType: string;
    from: Date;
    to: Date;
  }) {
    if (!Types.ObjectId.isValid(input.patientId)) return null;
    const metric = await this.healthMetricModel
      .findOne({
        'meta.patientId': new Types.ObjectId(input.patientId),
        'meta.metricType': input.metricType,
        validationStatus: HealthMetricValidationStatus.VALID,
        recordedAt: { $gte: input.from, $lte: input.to },
      })
      .sort({ recordedAt: 1, _id: 1 })
      .select('_id recordedAt ingestedAt values')
      .lean()
      .exec();
    return metric
      ? {
          id: String(metric._id),
          recordedAt: metric.recordedAt,
          ingestedAt: metric.ingestedAt,
          values: metric.values,
        }
      : null;
  }

  async listRecordedInWindow(input: {
    patientId: string;
    from: Date;
    to: Date;
    ingestedUntil: Date;
    limit: number;
  }) {
    if (!Types.ObjectId.isValid(input.patientId))
      return { items: [], truncated: false };
    const limit = Math.max(1, Math.min(5_000, Math.floor(input.limit)));
    const rows = await this.healthMetricModel
      .find({
        'meta.patientId': new Types.ObjectId(input.patientId),
        recordedAt: { $gte: input.from, $lt: input.to },
        ingestedAt: { $lte: input.ingestedUntil },
        validationStatus: {
          $ne: HealthMetricValidationStatus.REJECTED,
        },
      })
      .select(HEALTH_METRIC_READ_PROJECTION)
      .sort({ recordedAt: 1, _id: 1 })
      .limit(limit + 1)
      .lean()
      .exec();
    const replacementRows = rows.length
      ? await this.healthMetricModel
          .find({
            replacesMetricId: { $in: rows.map((row) => row._id) },
            ingestedAt: { $lte: input.ingestedUntil },
          })
          .select('replacesMetricId')
          .limit(limit + 1)
          .lean()
          .exec()
      : [];
    const replacedIds = new Set(
      replacementRows.map((row) => String(row.replacesMetricId)),
    );
    const effective = rows.filter(
      (row) =>
        !replacedIds.has(String(row._id)) &&
        !(
          row.validationStatus === HealthMetricValidationStatus.VOIDED &&
          row.voidedAt &&
          row.voidedAt <= input.ingestedUntil
        ),
    );
    return {
      items: effective.slice(0, limit).map((row) => this.toReportItem(row)),
      truncated: rows.length > limit || replacementRows.length > limit,
    };
  }

  async findAll(
    userId: string,
    userRole: string | undefined,
    query: QueryHealthMetricDto,
  ) {
    if (!Types.ObjectId.isValid(userId))
      throw new BadRequestException('Invalid user ID');
    let patientId = userId;
    if (query.patientId) {
      if (!Types.ObjectId.isValid(query.patientId))
        throw new BadRequestException('Invalid patient ID');
      if (userRole !== 'doctor' && userRole !== 'admin')
        throw new BadRequestException('Not allowed to view patient metrics');
      patientId = query.patientId;
    }
    const filter: Record<string, unknown> = {
      'meta.patientId': new Types.ObjectId(patientId),
    };
    if (query.metricType) filter['meta.metricType'] = query.metricType;
    if (query.startDate || query.endDate)
      filter.recordedAt = {
        ...(query.startDate ? { $gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { $lte: new Date(query.endDate) } : {}),
      };
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
    const [rows, total] = await Promise.all([
      this.healthMetricModel
        .find(cursorFilter)
        .select(HEALTH_METRIC_READ_PROJECTION)
        .sort({ [sortField]: sortOrder, _id: sortOrder })
        .skip(skip)
        .limit(query.limit + 1)
        .lean()
        .exec(),
      this.healthMetricModel.countDocuments(filter),
    ]);
    const hasNextPage = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    const lastSortValue = last?.[sortField];
    return {
      statusCode: 200,
      message: 'Health metrics retrieved successfully',
      data: items.map((row) => this.toDto(row)),
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
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(userId))
      throw new BadRequestException('Invalid metric ID');
    const metric = await this.healthMetricModel
      .findOne({
        _id: new Types.ObjectId(id),
        'meta.patientId': new Types.ObjectId(userId),
      })
      .select(HEALTH_METRIC_READ_PROJECTION)
      .lean()
      .exec();
    if (!metric) throw new NotFoundException('Health metric not found');
    return {
      statusCode: 200,
      message: 'Health metric retrieved successfully',
      data: this.toDto(metric),
    };
  }

  async getStatistics(
    userId: string,
    metricTypeValue: string,
    query?: QueryHealthMetricDto,
  ) {
    if (!Types.ObjectId.isValid(userId))
      throw new BadRequestException('Invalid user ID');
    if (!METRIC_TYPE_VALUES.includes(metricTypeValue))
      throw new BadRequestException('Invalid metric type');
    const metricType = metricTypeValue as MetricType;
    const endDate = query?.endDate ? new Date(query.endDate) : new Date();
    const startDate = query?.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate > endDate ||
      endDate.getTime() - startDate.getTime() > 366 * 24 * 60 * 60 * 1000
    )
      throw new BadRequestException('Invalid statistics date range');
    const [result] =
      await this.healthMetricModel.aggregate<HealthMetricStatisticsAggregation>(
        [
          {
            $match: {
              'meta.patientId': new Types.ObjectId(userId),
              'meta.metricType': metricType,
              validationStatus: HealthMetricValidationStatus.VALID,
              recordedAt: { $gte: startDate, $lte: endDate },
            },
          },
          { $sort: { recordedAt: -1, _id: -1 } },
          {
            $facet: {
              stats: [{ $count: 'count' }],
              numericStats: [
                {
                  $group: {
                    _id: null,
                    average: {
                      $avg: `$values.${PRIMARY_VALUE_KEY_BY_TYPE[metricType]}`,
                    },
                    minimum: {
                      $min: `$values.${PRIMARY_VALUE_KEY_BY_TYPE[metricType]}`,
                    },
                    maximum: {
                      $max: `$values.${PRIMARY_VALUE_KEY_BY_TYPE[metricType]}`,
                    },
                  },
                },
                { $project: { _id: 0 } },
              ],
              latest: [{ $limit: 1 }],
            },
          },
        ],
      );
    if (!result?.latest.length)
      throw new NotFoundException('No metrics found for this type');
    const stats = result.numericStats[0];
    if (!stats)
      throw new BadRequestException('No numeric values found in metrics');
    return {
      statusCode: 200,
      message: 'Statistics retrieved successfully',
      data: {
        metricType,
        count: result.stats[0]?.count ?? 0,
        average: Math.round(stats.average * 100) / 100,
        minimum: stats.minimum,
        maximum: stats.maximum,
        latest: this.toDto(result.latest[0]),
      },
    };
  }

  private toReportItem(row: HealthMetricReadRow): HealthMetricReportItem {
    return {
      id: String(row._id),
      metricType: row.meta.metricType,
      unit: row.meta.unit,
      values: row.values,
      recordedAt: row.recordedAt,
      ingestedAt: row.ingestedAt,
    };
  }

  private toDto(row: HealthMetricReadRow) {
    return {
      id: String(row._id),
      patientId: String(row.meta.patientId),
      metricType: row.meta.metricType,
      unit: row.meta.unit,
      values: row.values,
      source: row.source,
      ...(row.sourceRef ? { sourceRef: row.sourceRef } : {}),
      validationStatus: row.validationStatus,
      validationReasonCodes: row.validationReasonCodes,
      ...(row.recordedTimezone
        ? { recordedTimezone: row.recordedTimezone }
        : {}),
      ...(row.replacesMetricId
        ? { replacesMetricId: String(row.replacesMetricId) }
        : {}),
      recordedAt: row.recordedAt,
      ingestedAt: row.ingestedAt,
      ...(row.voidedAt ? { voidedAt: row.voidedAt } : {}),
      ...(row.voidReason ? { voidReason: row.voidReason } : {}),
      createdAt: row.createdAt,
    };
  }
}
