import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { decodeCursor, encodeCursor } from '../../../../common/pagination';
import {
  HealthMetric,
  HealthMetricDocument,
  HealthMetricValidationStatus,
  MetricType,
} from '../../domain/entities/health-metric.entity';
import type { SharedHealthMetricPort } from '../../application/ports/shared-health-metric.port';
import {
  SHARED_HEALTH_METRIC_QUERY,
  type SharedHealthMetricQueryPort,
} from '../../application/ports/shared-health-metric-query.port';

// A new metric type is shareable only after its safe value projection is defined.
const VALUE_KEYS: Partial<Record<MetricType, readonly string[]>> = {
  [MetricType.BLOOD_PRESSURE]: ['systolic', 'diastolic'],
  [MetricType.HEART_RATE]: ['value'],
  [MetricType.BLOOD_GLUCOSE]: ['value'],
  [MetricType.OXYGEN_SATURATION]: ['value'],
  [MetricType.BODY_TEMPERATURE]: ['value'],
  [MetricType.RESPIRATORY_RATE]: ['value'],
  [MetricType.BMI]: ['value'],
  [MetricType.WEIGHT]: ['value'],
  [MetricType.HEIGHT]: ['value'],
  [MetricType.WATER_INTAKE]: ['amount'],
  [MetricType.KCAL_INTAKE]: ['amount'],
};

@Injectable()
export class MongooseSharedHealthMetricReader implements SharedHealthMetricPort {
  constructor(
    @InjectModel(HealthMetric.name)
    private readonly metrics: Model<HealthMetricDocument>,
    @Inject(SHARED_HEALTH_METRIC_QUERY)
    private readonly canonicalQueries: SharedHealthMetricQueryPort,
  ) {}

  supportedTypes(): readonly string[] {
    return Object.values(MetricType).filter((type) =>
      Boolean(VALUE_KEYS[type]),
    );
  }

  async summary(input: {
    patientId: string;
    metricType: string;
    from?: Date;
    to?: Date;
  }) {
    const keys = VALUE_KEYS[input.metricType as MetricType];
    if (!keys || !Types.ObjectId.isValid(input.patientId))
      throw new BadRequestException('INVALID_SHARED_METRIC_QUERY');
    this.assertValidDateRange(input.from, input.to);
    const result = await this.canonicalQueries.getStatisticsInWindow(
      input.patientId,
      input.metricType,
      input.from,
      input.to,
    );
    const latest = result.data.latest;
    const values: Record<string, number> = {};
    for (const key of keys) {
      const value = latest.values?.[key];
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new BadRequestException('INVALID_SHARED_METRIC_VALUE');
      values[key] = value;
    }
    return {
      metricType: result.data.metricType,
      count: result.data.count,
      average: result.data.average,
      minimum: result.data.minimum,
      maximum: result.data.maximum,
      latest: {
        metricType: latest.metricType,
        unit: latest.unit,
        values,
        recordedAt: latest.recordedAt,
      },
    };
  }

  async trend(input: {
    patientId: string;
    metricType: string;
    from?: Date;
    to?: Date;
    cursor?: string;
    limit: number;
  }) {
    const keys = VALUE_KEYS[input.metricType as MetricType];
    if (!keys || !Types.ObjectId.isValid(input.patientId))
      throw new BadRequestException('INVALID_SHARED_METRIC_QUERY');
    this.assertValidDateRange(input.from, input.to);
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)
      throw new BadRequestException('INVALID_SHARED_METRIC_LIMIT');
    const limit = input.limit;
    const filter: Record<string, unknown> = {
      'meta.patientId': new Types.ObjectId(input.patientId),
      'meta.metricType': input.metricType,
      validationStatus: HealthMetricValidationStatus.VALID,
    };
    if (input.from || input.to)
      filter.recordedAt = {
        ...(input.from && { $gte: input.from }),
        ...(input.to && { $lt: input.to }),
      };
    if (input.cursor) {
      try {
        const cursor = decodeCursor(input.cursor);
        const date = new Date(cursor.sortValue);
        if (
          !Number.isFinite(date.getTime()) ||
          !Types.ObjectId.isValid(cursor.id)
        )
          throw new Error();
        filter.$or = [
          { recordedAt: { $lt: date } },
          { recordedAt: date, _id: { $lt: new Types.ObjectId(cursor.id) } },
        ];
      } catch {
        throw new BadRequestException('INVALID_SHARED_METRIC_CURSOR');
      }
    }
    const rows = await this.metrics
      .find(filter)
      .select(
        `_id meta.metricType meta.unit values.${keys.join(' values.')} recordedAt`,
      )
      .sort({ recordedAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean()
      .exec();
    const page = rows.slice(0, limit);
    const items = page.map((row) => {
      const values: Record<string, number> = {};
      for (const key of keys) {
        const value = row.values?.[key];
        if (typeof value !== 'number' || !Number.isFinite(value))
          throw new BadRequestException('INVALID_SHARED_METRIC_VALUE');
        values[key] = value;
      }
      return {
        metricType: row.meta.metricType,
        unit: row.meta.unit,
        values,
        recordedAt: row.recordedAt,
      };
    });
    const last = page.at(-1);
    return {
      items,
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({
              sortValue: last.recordedAt.toISOString(),
              id: String(last._id),
            })
          : null,
    };
  }

  private assertValidDateRange(from?: Date, to?: Date) {
    if (
      (from && !Number.isFinite(from.getTime())) ||
      (to && !Number.isFinite(to.getTime())) ||
      (from && to && from >= to)
    )
      throw new BadRequestException('INVALID_SHARED_METRIC_DATE_RANGE');
  }
}
