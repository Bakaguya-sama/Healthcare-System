import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  evaluateMetricThreshold,
  Gender,
} from './health-metrics-alert.evaluator';
import {
  HealthMetric,
  HealthMetricDocument,
  MetricType,
} from './entities/health-metric.entity';
import {
  NotificationsService,
  NotificationType,
} from '../notifications/public-api';
import { UsersService } from '../users/public-api';

type MetricEntry = {
  value: number;
  recordedAt: Date | string;
};

type DailyTotalAlertMetricType =
  | MetricType.WATER_INTAKE
  | MetricType.KCAL_INTAKE;

const WATER_INTAKE_CUTOFF_HOUR = 21;
const HEALTH_METRIC_READ_PROJECTION =
  '_id patientId type values unit recordedAt createdAt updatedAt source timezone';
const LOW_STATUS_KEYWORDS = ['low', 'hypo', 'under', 'below'];
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
const DEFAULT_UNIT_BY_TYPE: Record<MetricType, string> = {
  [MetricType.BLOOD_PRESSURE]: 'mmHg',
  [MetricType.HEART_RATE]: 'bpm',
  [MetricType.BLOOD_GLUCOSE]: 'mg/dL',
  [MetricType.OXYGEN_SATURATION]: '%',
  [MetricType.BODY_TEMPERATURE]: 'C',
  [MetricType.RESPIRATORY_RATE]: 'breaths/min',
  [MetricType.BMI]: 'kg/m2',
  [MetricType.WEIGHT]: 'kg',
  [MetricType.HEIGHT]: 'cm',
  [MetricType.WATER_INTAKE]: 'L',
  [MetricType.KCAL_INTAKE]: 'kcal',
};
const METRIC_LABEL_BY_TYPE: Record<MetricType, string> = {
  [MetricType.BLOOD_PRESSURE]: 'Blood Pressure',
  [MetricType.HEART_RATE]: 'Heart Rate',
  [MetricType.BLOOD_GLUCOSE]: 'Blood Glucose',
  [MetricType.OXYGEN_SATURATION]: 'O2 Saturation',
  [MetricType.BODY_TEMPERATURE]: 'Body Temperature',
  [MetricType.RESPIRATORY_RATE]: 'Respiratory Rate',
  [MetricType.BMI]: 'BMI',
  [MetricType.WEIGHT]: 'Weight',
  [MetricType.HEIGHT]: 'Height',
  [MetricType.WATER_INTAKE]: 'Water Intake',
  [MetricType.KCAL_INTAKE]: 'Calories',
};

@Injectable()
export class HealthMetricAlertService {
  constructor(
    @InjectModel(HealthMetric.name)
    private readonly healthMetricModel: Model<HealthMetricDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

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

  private extractMetricNumericValue(
    type: MetricType,
    values: Record<string, MetricEntry>,
  ): number {
    const primaryValue = values?.[PRIMARY_VALUE_KEY_BY_TYPE[type]]?.value;
    if (typeof primaryValue === 'number' && Number.isFinite(primaryValue)) {
      return primaryValue;
    }
    for (const detail of Object.values(values ?? {})) {
      if (
        detail &&
        typeof detail === 'object' &&
        typeof detail.value === 'number' &&
        Number.isFinite(detail.value)
      ) {
        return detail.value;
      }
    }
    return 0;
  }

  private resolveUnitForType(type: MetricType): string {
    const unit = DEFAULT_UNIT_BY_TYPE[type];
    if (!unit) {
      throw new BadRequestException(
        `No unit configuration found for type ${type}`,
      );
    }
    return unit;
  }

  async evaluateAndNotify(
    userId: string,
    metricType: MetricType,
    values: Record<string, MetricEntry>,
  ) {
    const evaluatorType = this.toSupportedEvaluatorType(metricType);
    if (!evaluatorType) {
      return null;
    }

    const { evaluationInput, referenceRecordedAt } =
      await this.resolveAlertEvaluationInput(userId, metricType, values);

    const userInfo = await this.usersService.findById(userId);
    const dailyTotalValue = evaluationInput.value ?? 0;
    const waterIntakeMax = this.resolveWaterIntakeMax(userInfo.gender);
    const isWaterIntakeOverMax =
      metricType === MetricType.WATER_INTAKE &&
      dailyTotalValue > waterIntakeMax;

    const evaluation = evaluateMetricThreshold(evaluatorType, evaluationInput, {
      gender: userInfo.gender
        ? (userInfo.gender as Gender)
        : ('male' as Gender),
    });

    if (
      metricType === MetricType.WATER_INTAKE &&
      evaluation &&
      this.isLowStatus(evaluation.status) &&
      !this.hasReachedWaterCutoff(referenceRecordedAt) &&
      !isWaterIntakeOverMax
    ) {
      return null;
    }

    if (
      !evaluation ||
      (!evaluation.shouldTriggerAlert && !isWaterIntakeOverMax)
    ) {
      return null;
    }

    const metricLabel = METRIC_LABEL_BY_TYPE[metricType] || metricType;
    const statusLabel = evaluation?.status ?? 'Outside safe threshold';

    const metricValue = this.extractMetricNumericValue(metricType, values);
    const metricUnit = this.resolveUnitForType(metricType);
    const advice = `${statusLabel}: ${metricLabel} (${metricValue} ${metricUnit}) is outside the configured safe threshold. This is an advisory notification, not a diagnosis. Please contact a healthcare professional if you have concerning symptoms.`;

    const notification = await this.notificationsService.create(userId, {
      userId: userId,
      type: NotificationType.CRITICAL,
      title: `Critical ${metricLabel} alert`,
      message: advice,
    });

    return notification.data;
  }

  private resolveWaterIntakeMax(gender?: string): number {
    const normalizedGender = (gender || '').toLowerCase();

    if (normalizedGender === 'female') {
      return 4.5;
    }

    return 5.5;
  }

  private isDailyTotalAlertMetricType(
    metricType: MetricType,
  ): metricType is DailyTotalAlertMetricType {
    return (
      metricType === MetricType.WATER_INTAKE ||
      metricType === MetricType.KCAL_INTAKE
    );
  }

  private isLowStatus(status: string): boolean {
    const normalizedStatus = status.toLowerCase();
    return LOW_STATUS_KEYWORDS.some((keyword) =>
      normalizedStatus.includes(keyword),
    );
  }

  private hasReachedWaterCutoff(referenceRecordedAt: Date): boolean {
    const now = new Date();

    const referenceDayStart = new Date(referenceRecordedAt);
    referenceDayStart.setHours(0, 0, 0, 0);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    if (referenceDayStart.getTime() < todayStart.getTime()) {
      return true;
    }

    if (referenceDayStart.getTime() > todayStart.getTime()) {
      return false;
    }

    return now.getHours() >= WATER_INTAKE_CUTOFF_HOUR;
  }

  private resolveReferenceRecordedAt(
    values: Record<string, MetricEntry>,
    metricType: MetricType,
  ): Date {
    const primaryKey = PRIMARY_VALUE_KEY_BY_TYPE[metricType];
    const primaryRecordedAt = values?.[primaryKey]?.recordedAt;

    if (primaryRecordedAt) {
      const parsed = new Date(primaryRecordedAt);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    for (const detail of Object.values(values ?? {})) {
      if (!detail || typeof detail !== 'object') {
        continue;
      }

      const parsed = new Date(detail.recordedAt);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return new Date();
  }

  private getUtcDayRange(date: Date): { start: Date; end: Date } {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();

    const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

    return { start, end };
  }

  private normalizeDailyAlertValue(
    metricType: DailyTotalAlertMetricType,
    total: number,
    unit?: string,
  ): number {
    if (metricType === MetricType.WATER_INTAKE) {
      const normalizedUnit = (unit || '').toLowerCase().trim();
      if (normalizedUnit === 'ml') {
        return total / 1000;
      }
      return total;
    }

    return total;
  }

  private async resolveAlertEvaluationInput(
    userId: string,
    metricType: MetricType,
    values: Record<string, MetricEntry>,
  ): Promise<{
    evaluationInput: ReturnType<typeof this.toEvaluationInput>;
    referenceRecordedAt: Date;
  }> {
    const referenceRecordedAt = this.resolveReferenceRecordedAt(
      values,
      metricType,
    );

    if (!this.isDailyTotalAlertMetricType(metricType)) {
      return {
        evaluationInput: this.toEvaluationInput(values),
        referenceRecordedAt,
      };
    }

    const patientId = new Types.ObjectId(userId);
    const primaryKey = PRIMARY_VALUE_KEY_BY_TYPE[metricType];
    const { start, end } = this.getUtcDayRange(referenceRecordedAt);

    const [result] = await this.healthMetricModel.aggregate<{ total: number }>([
      {
        $match: {
          patientId,
          type: metricType,
          recordedAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: `$values.${primaryKey}.value`,
          },
        },
      },
    ]);

    const rawDailyTotal = result?.total ?? 0;
    const latestMetric = await this.healthMetricModel
      .findOne({
        patientId,
        type: metricType,
        recordedAt: {
          $gte: start,
          $lte: end,
        },
      })
      .sort({ recordedAt: -1 })
      .select('unit')
      .lean<{ unit?: string }>();

    const normalizedDailyTotal = this.normalizeDailyAlertValue(
      metricType,
      rawDailyTotal,
      latestMetric?.unit,
    );

    return {
      evaluationInput: {
        value: normalizedDailyTotal,
      },
      referenceRecordedAt,
    };
  }

  async getAlerts(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const alerts = await this.healthMetricModel
      .find({
        patientId: new Types.ObjectId(userId),
      })
      .select(HEALTH_METRIC_READ_PROJECTION)
      .sort({ recordedAt: -1, _id: -1 })
      .limit(20)
      .lean()
      .exec();

    return {
      statusCode: 200,
      message: 'Alerts retrieved successfully',
      data: alerts,
      count: alerts.length,
    };
  }

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
