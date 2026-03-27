import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  HealthMetric,
  HealthMetricDocument,
  MetricValueDetail,
  MetricType,
} from './entities/health-metric.entity';
import { CreateHealthMetricDto } from './dto/create-health-metric.dto';
import { UpdateHealthMetricDto } from './dto/update-health-metric.dto';
import { QueryHealthMetricDto } from './dto/query-health-metric.dto';
import { evaluateMetricThreshold } from './health-metrics-alert.evaluator';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

type MetricEntry = {
  value: number;
  recordedAt: Date | string;
};

const BMI_UNIT = 'kg/m2';

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

const REQUIRED_KEYS_BY_TYPE: Record<MetricType, string[]> = {
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

const DEFAULT_UNIT_BY_TYPE: Record<MetricType, string> = {
  [MetricType.BLOOD_PRESSURE]: 'mmHg',
  [MetricType.HEART_RATE]: 'bpm',
  [MetricType.BLOOD_GLUCOSE]: 'mg/dL',
  [MetricType.OXYGEN_SATURATION]: '%',
  [MetricType.BODY_TEMPERATURE]: 'C',
  [MetricType.RESPIRATORY_RATE]: 'breaths/min',
  [MetricType.BMI]: BMI_UNIT,
  [MetricType.WEIGHT]: 'kg',
  [MetricType.HEIGHT]: 'cm',
  [MetricType.WATER_INTAKE]: 'ml',
  [MetricType.KCAL_INTAKE]: 'kcal',
};

@Injectable()
export class HealthMetricsService {
  constructor(
    @InjectModel(HealthMetric.name)
    private healthMetricModel: Model<HealthMetricDocument>,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * 📝 TẠO HEALTH METRIC MỚI
   */
  async create(userId: string, dto: CreateHealthMetricDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const patientId = new Types.ObjectId(userId);

    this.assertValidValuesForType(dto.type, dto.values);
    const resolvedUnit = this.resolveUnitForType(dto.type);

    const metric = await this.healthMetricModel.create({
      patientId,
      type: dto.type,
      values: dto.values,
      unit: resolvedUnit,
      recordedAt: dto.recordedAt || new Date(),
    });

    if (dto.type === MetricType.HEIGHT || dto.type === MetricType.WEIGHT) {
      await this.upsertBmiFromLatestMetrics(
        patientId,
        dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
      );
    }

    const noti = await this.maybeCreateAlertNotification(
      userId,
      dto.type,
      dto.values,
    );

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

    const filter: {
      patientId: Types.ObjectId;
      type?: MetricType;
      recordedAt?: {
        $gte?: Date;
        $lte?: Date;
      };
    } = {
      patientId: new Types.ObjectId(userId),
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
    const skip = (query.page - 1) * query.limit;
    const sort = {
      [query.sortBy || 'recordedAt']: query.sortOrder || -1,
    };

    // Execute query
    const [data, total] = await Promise.all([
      this.healthMetricModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(query.limit),
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
      patientId: new Types.ObjectId(userId),
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
  async update(userId: string, id: string, dto: UpdateHealthMetricDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid metric ID');
    }

    const patientId = new Types.ObjectId(userId);

    const metric = await this.healthMetricModel.findOne({
      _id: new Types.ObjectId(id),
      patientId,
    });

    if (!metric) {
      throw new NotFoundException('Health metric not found');
    }

    const effectiveType = dto.type ?? metric.type;
    const resolvedUnit = this.resolveUnitForType(effectiveType);

    if (dto.values) {
      this.assertValidValuesForType(
        effectiveType,
        dto.values as Record<string, MetricEntry>,
      );
    }

    // Update fields
    Object.assign(metric, {
      ...dto,
      unit: resolvedUnit,
    });
    await metric.save();

    if (
      effectiveType === MetricType.HEIGHT ||
      effectiveType === MetricType.WEIGHT
    ) {
      await this.upsertBmiFromLatestMetrics(
        patientId,
        dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
      );
    }

    const alert = dto.values
      ? await this.maybeCreateAlertNotification(
          userId,
          effectiveType,
          dto.values as Record<string, MetricEntry>,
        )
      : null;

    return {
      statusCode: 200,
      message: 'Health metric updated successfully',
      data: metric,
    };
  }

  private toEvaluationInput(values: Record<string, MetricEntry>): {
    value?: number;
    systolic?: number;
    diastolic?: number;
  } {
    return {
      value: values?.value?.value ?? values?.amount?.value,
      systolic: values?.systolic?.value,
      diastolic: values?.diastolic?.value,
    };
  }

  private toSupportedEvaluatorType(
    type: MetricType,
  ):
    | 'blood_pressure'
    | 'heart_rate'
    | 'blood_glucose'
    | 'oxygen_saturation'
    | 'body_temperature'
    | 'respiratory_rate'
    | 'bmi'
    | 'water_intake'
    | 'kcal_intake'
    | null {
    switch (type) {
      case MetricType.BLOOD_PRESSURE:
      case MetricType.HEART_RATE:
      case MetricType.BLOOD_GLUCOSE:
      case MetricType.OXYGEN_SATURATION:
      case MetricType.BODY_TEMPERATURE:
      case MetricType.RESPIRATORY_RATE:
      case MetricType.BMI:
      case MetricType.WATER_INTAKE:
      case MetricType.KCAL_INTAKE:
        return type;
      default:
        return null;
    }
  }

  private async maybeCreateAlertNotification(
    userId: string,
    metricType: MetricType,
    values: Record<string, MetricEntry>,
  ) {
    const evaluatorType = this.toSupportedEvaluatorType(metricType);
    if (!evaluatorType) {
      return null;
    }

    const evaluation = evaluateMetricThreshold(
      evaluatorType,
      this.toEvaluationInput(values),
      {
        // TODO: Replace with real patient profile.
        gender: 'male',
      },
    );

    if (!evaluation || !evaluation.shouldTriggerAlert) {
      return null;
    }

    const notification = await this.notificationsService.create(userId, {
      type: NotificationType.CRITICAL,
      title: `Critical ${metricType} alert`,
      message: `${evaluation.status}: ${metricType} is outside safe threshold.`,
    });

    return notification.data;
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
      patientId: new Types.ObjectId(userId),
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
      patientId: new Types.ObjectId(userId),
      type,
    });

    if (metrics.length === 0) {
      throw new NotFoundException('No metrics found for this type');
    }

    // Extract numeric values from values.<key>.value
    const values = metrics
      .map((metric) =>
        this.extractMetricNumericValue(metric.type, metric.values),
      )
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

  private assertValidValuesForType(
    type: MetricType,
    values: Record<string, MetricEntry>,
  ): void {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      throw new BadRequestException('values must be a valid object');
    }

    const requiredKeys = REQUIRED_KEYS_BY_TYPE[type] || [];
    const keys = Object.keys(values);
    const requiredKeySet = new Set(requiredKeys);

    if (keys.length !== requiredKeys.length) {
      throw new BadRequestException(
        `values for ${type} must contain exactly: ${requiredKeys.join(', ')}`,
      );
    }

    if (!keys.every((key) => requiredKeySet.has(key))) {
      throw new BadRequestException(
        `values contains unexpected keys for ${type}`,
      );
    }

    for (const [key, detail] of Object.entries(values)) {
      if (!detail || typeof detail !== 'object' || Array.isArray(detail)) {
        throw new BadRequestException(`values.${key} must be an object`);
      }

      if (
        typeof detail.value !== 'number' ||
        !Number.isFinite(detail.value) ||
        detail.value < 0
      ) {
        throw new BadRequestException(
          `values.${key}.value must be a non-negative number`,
        );
      }

      const recordedDate = new Date(detail.recordedAt);
      if (!detail.recordedAt || Number.isNaN(recordedDate.getTime())) {
        throw new BadRequestException(
          `values.${key}.recordedAt must be a valid date`,
        );
      }
    }
  }

  private extractMetricNumericValue(
    type: MetricType,
    values: Record<string, MetricEntry>,
  ): number {
    const primaryKey = PRIMARY_VALUE_KEY_BY_TYPE[type];
    const primaryValue = values?.[primaryKey]?.value;

    if (typeof primaryValue === 'number' && Number.isFinite(primaryValue)) {
      return primaryValue;
    }

    for (const detail of Object.values(values ?? {})) {
      if (!detail || typeof detail !== 'object') {
        continue;
      }

      if (typeof detail.value === 'number' && Number.isFinite(detail.value)) {
        return detail.value;
      }
    }

    return 0;
  }

  private async upsertBmiFromLatestMetrics(
    patientId: Types.ObjectId,
    referenceRecordedAt: Date,
  ): Promise<void> {
    const [latestHeightMetric, latestWeightMetric] = await Promise.all([
      this.healthMetricModel
        .findOne({
          patientId,
          type: MetricType.HEIGHT,
        })
        .sort({ recordedAt: -1 }),
      this.healthMetricModel
        .findOne({
          patientId,
          type: MetricType.WEIGHT,
        })
        .sort({ recordedAt: -1 }),
    ]);

    if (!latestHeightMetric || !latestWeightMetric) {
      return;
    }

    const rawHeight = this.extractMetricNumericValue(
      MetricType.HEIGHT,
      latestHeightMetric.values as Record<string, MetricEntry>,
    );
    const rawWeight = this.extractMetricNumericValue(
      MetricType.WEIGHT,
      latestWeightMetric.values as Record<string, MetricEntry>,
    );

    if (rawHeight <= 0 || rawWeight <= 0) {
      return;
    }

    const heightInMeters = this.normalizeHeightToMeters(
      rawHeight,
      latestHeightMetric.unit,
    );
    const weightInKg = this.normalizeWeightToKg(
      rawWeight,
      latestWeightMetric.unit,
    );

    if (heightInMeters <= 0 || weightInKg <= 0) {
      return;
    }

    const bmiValue =
      Math.round((weightInKg / (heightInMeters * heightInMeters)) * 100) / 100;

    const bmiValues: Record<string, MetricValueDetail> = {
      value: {
        value: bmiValue,
        recordedAt: referenceRecordedAt,
      },
    };

    const latestBmiMetric = await this.healthMetricModel
      .findOne({
        patientId,
        type: MetricType.BMI,
      })
      .sort({ recordedAt: -1 });

    if (latestBmiMetric) {
      latestBmiMetric.values = bmiValues;
      latestBmiMetric.unit = BMI_UNIT;
      latestBmiMetric.recordedAt = referenceRecordedAt;
      await latestBmiMetric.save();
      return;
    }

    await this.healthMetricModel.create({
      patientId,
      type: MetricType.BMI,
      values: bmiValues,
      unit: BMI_UNIT,
      recordedAt: referenceRecordedAt,
    });
  }

  private normalizeHeightToMeters(value: number, unit?: string): number {
    const normalizedUnit = (unit || '').toLowerCase().trim();

    if (normalizedUnit === 'cm') {
      return value / 100;
    }

    return value;
  }

  private normalizeWeightToKg(value: number, unit?: string): number {
    const normalizedUnit = (unit || '').toLowerCase().trim();

    if (normalizedUnit === 'lb' || normalizedUnit === 'lbs') {
      return value * 0.45359237;
    }

    return value;
  }

  private resolveUnitForType(type: MetricType): string {
    const defaultUnit = DEFAULT_UNIT_BY_TYPE[type];

    if (!defaultUnit) {
      throw new BadRequestException(
        `No unit configuration found for type ${type}`,
      );
    }

    return defaultUnit;
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
        patientId: new Types.ObjectId(userId),
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
        patientId: new Types.ObjectId(userId),
      },
      {},
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
