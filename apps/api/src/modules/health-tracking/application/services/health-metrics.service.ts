import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { AuditLog } from '../../../platform-audit/public-api';
import { NotificationsService } from '../../../notifications/public-api';
import { UsersService } from '../../../users/public-api';
import {
  HealthMetric,
  HealthMetricDocument,
  HealthMetricSource,
  HealthMetricValidationStatus,
  MetricType,
} from '../../domain/entities/health-metric.entity';
import { CorrectHealthMetricDto } from '../../presentation/dto/correct-health-metric.dto';
import { CreateHealthMetricDto } from '../../presentation/dto/create-health-metric.dto';
import { QueryHealthMetricDto } from '../../presentation/dto/query-health-metric.dto';
import type {
  HealthProfileMetric,
  HealthProfilePort,
} from '../ports/health-profile.port';
import { HealthMetricAlertService } from './health-metric-alert.service';
import { HealthMetricQueryService } from './health-metric-query.service';

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
  [MetricType.WATER_INTAKE]: 'L',
  [MetricType.KCAL_INTAKE]: 'kcal',
};

@Injectable()
export class HealthMetricsService implements HealthProfilePort {
  private readonly healthMetricQueries: HealthMetricQueryService;
  private readonly healthMetricAlerts: HealthMetricAlertService;

  constructor(
    @InjectModel(HealthMetric.name)
    private readonly healthMetricModel: Model<HealthMetricDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditLogs: Model<AuditLog>,
    @InjectConnection() private readonly connection: Connection,
    notificationsService: NotificationsService,
    usersService: UsersService,
    @Optional() healthMetricQueries?: HealthMetricQueryService,
    @Optional() healthMetricAlerts?: HealthMetricAlertService,
  ) {
    this.healthMetricQueries =
      healthMetricQueries ?? new HealthMetricQueryService(healthMetricModel);
    this.healthMetricAlerts =
      healthMetricAlerts ??
      new HealthMetricAlertService(
        healthMetricModel,
        notificationsService,
        usersService,
      );
  }

  readRecentMetrics(
    patientId: string,
    limit = 20,
  ): Promise<HealthProfileMetric[]> {
    return this.healthMetricQueries.readRecentMetrics(patientId, limit);
  }

  async create(userId: string, dto: CreateHealthMetricDto) {
    const patientId = this.patientObjectId(userId);
    this.assertValidValuesForType(dto.metricType, dto.values);
    const recordedAt = dto.recordedAt ?? new Date();
    const now = new Date();
    const metric = await this.healthMetricModel.create({
      meta: {
        patientId,
        metricType: dto.metricType,
        unit: this.resolveUnitForType(dto.metricType),
      },
      values: dto.values,
      source: dto.source ?? HealthMetricSource.MANUAL,
      sourceRef: {
        ...dto.sourceRef,
        enteredBy: patientId,
      },
      validationStatus: HealthMetricValidationStatus.VALID,
      validationReasonCodes: [],
      recordedTimezone: dto.recordedTimezone ?? 'UTC',
      recordedAt,
      ingestedAt: now,
    });

    if (
      dto.metricType === MetricType.HEIGHT ||
      dto.metricType === MetricType.WEIGHT
    )
      await this.createBmiFromLatestMetrics(patientId, recordedAt);

    await this.healthMetricAlerts.evaluateAndNotify(
      userId,
      dto.metricType,
      dto.values,
      recordedAt,
    );
    return {
      statusCode: 201,
      message: 'Health metric recorded successfully',
      data: this.toDto(metric.toObject()),
    };
  }

  findAll(
    userId: string,
    userRole: string | undefined,
    query: QueryHealthMetricDto,
  ) {
    return this.healthMetricQueries.findAll(userId, userRole, query);
  }

  findOne(userId: string, id: string) {
    return this.healthMetricQueries.findOne(userId, id);
  }

  async correct(userId: string, id: string, dto: CorrectHealthMetricDto) {
    const patientId = this.patientObjectId(userId);
    const metricId = this.metricObjectId(id);
    const original = await this.healthMetricModel
      .findOne({ _id: metricId, 'meta.patientId': patientId })
      .exec();
    if (!original) throw new NotFoundException('Health metric not found');
    this.assertValidValuesForType(original.meta.metricType, dto.values);

    const existing = await this.healthMetricModel
      .findOne({ replacesMetricId: metricId, 'meta.patientId': patientId })
      .exec();
    if (existing) {
      if (this.sameCorrection(existing, dto))
        return {
          statusCode: 200,
          message: 'Health metric correction replayed',
          data: this.toDto(existing.toObject()),
        };
      throw new ConflictException('Health metric already has a correction');
    }
    if (original.validationStatus !== HealthMetricValidationStatus.VALID)
      throw new ConflictException('Only a valid metric can be corrected');

    const session = await this.connection.startSession();
    try {
      let replacement!: HealthMetricDocument;
      await session.withTransaction(async () => {
        const superseded = await this.healthMetricModel.findOneAndUpdate(
          {
            _id: metricId,
            'meta.patientId': patientId,
            validationStatus: HealthMetricValidationStatus.VALID,
          },
          {
            $set: {
              validationStatus: HealthMetricValidationStatus.SUPERSEDED,
              validationReasonCodes: ['corrected_by_patient'],
            },
          },
          { returnDocument: 'after', session },
        );
        if (!superseded)
          throw new ConflictException('Health metric changed concurrently');
        [replacement] = await this.healthMetricModel.create(
          [
            {
              meta: original.meta,
              values: dto.values,
              source: original.source,
              sourceRef: {
                ...(original.sourceRef?.deviceId
                  ? { deviceId: original.sourceRef.deviceId }
                  : {}),
                ...(original.sourceRef?.importBatchId
                  ? { importBatchId: original.sourceRef.importBatchId }
                  : {}),
                enteredBy: patientId,
              },
              validationStatus: HealthMetricValidationStatus.VALID,
              validationReasonCodes: [],
              recordedTimezone:
                dto.recordedTimezone ?? original.recordedTimezone,
              replacesMetricId: original._id,
              recordedAt: dto.recordedAt,
              ingestedAt: new Date(),
            },
          ],
          { session },
        );
        await this.auditLogs.create(
          [
            {
              domain: 'health',
              entityType: 'HealthMetric',
              entityId: original._id,
              action: 'correct',
              userId: patientId,
              actorId: patientId,
              fromStatus: HealthMetricValidationStatus.VALID,
              toStatus: HealthMetricValidationStatus.SUPERSEDED,
              reason: dto.reason,
              metadata: { replacementMetricId: String(replacement._id) },
            },
          ],
          { session },
        );
      });
      await this.healthMetricAlerts.evaluateAndNotify(
        userId,
        replacement.meta.metricType,
        replacement.values,
        replacement.recordedAt,
      );
      return {
        statusCode: 201,
        message: 'Health metric corrected successfully',
        data: this.toDto(replacement.toObject()),
      };
    } catch (error) {
      const mongoError = error as {
        code?: number;
        hasErrorLabel?: (label: string) => boolean;
      };
      const isConcurrentConflict =
        error instanceof ConflictException ||
        mongoError.code === 11000 ||
        mongoError.code === 112 ||
        mongoError.hasErrorLabel?.('TransientTransactionError') === true;
      if (isConcurrentConflict) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const replay = await this.healthMetricModel
            .findOne({
              replacesMetricId: metricId,
              'meta.patientId': patientId,
            })
            .exec();
          if (replay && this.sameCorrection(replay, dto))
            return {
              statusCode: 200,
              message: 'Health metric correction replayed',
              data: this.toDto(replay.toObject()),
            };
          await new Promise<void>((resolve) => setTimeout(resolve, 10));
        }
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async void(userId: string, id: string, reason: string) {
    const patientId = this.patientObjectId(userId);
    const metricId = this.metricObjectId(id);
    const session = await this.connection.startSession();
    try {
      let metric: HealthMetricDocument | null = null;
      await session.withTransaction(async () => {
        metric = await this.healthMetricModel.findOneAndUpdate(
          {
            _id: metricId,
            'meta.patientId': patientId,
            validationStatus: HealthMetricValidationStatus.VALID,
          },
          {
            $set: {
              validationStatus: HealthMetricValidationStatus.VOIDED,
              validationReasonCodes: ['voided_by_patient'],
              voidedAt: new Date(),
              voidedBy: patientId,
              voidReason: reason,
            },
          },
          { returnDocument: 'after', session },
        );
        if (!metric) return;
        await this.auditLogs.create(
          [
            {
              domain: 'health',
              entityType: 'HealthMetric',
              entityId: metricId,
              action: 'void',
              userId: patientId,
              actorId: patientId,
              fromStatus: HealthMetricValidationStatus.VALID,
              toStatus: HealthMetricValidationStatus.VOIDED,
              reason,
            },
          ],
          { session },
        );
      });
      if (!metric) {
        const current = await this.healthMetricModel.findOne({
          _id: metricId,
          'meta.patientId': patientId,
        });
        if (!current) throw new NotFoundException('Health metric not found');
        if (
          current.validationStatus === HealthMetricValidationStatus.VOIDED &&
          current.voidReason === reason
        )
          metric = current;
        else throw new ConflictException('Health metric cannot be voided');
      }
      return {
        statusCode: 200,
        message: 'Health metric voided successfully',
        data: this.toDto(metric.toObject()),
      };
    } finally {
      await session.endSession();
    }
  }

  getStatistics(
    userId: string,
    metricType: string,
    query?: QueryHealthMetricDto,
  ) {
    return this.healthMetricQueries.getStatistics(userId, metricType, query);
  }

  getAlerts(userId: string) {
    return this.healthMetricAlerts.getAlerts(userId);
  }

  markAsReviewed(userId: string, id: string) {
    return this.healthMetricAlerts.markAsReviewed(userId, id);
  }

  private patientObjectId(value: string) {
    if (!Types.ObjectId.isValid(value))
      throw new BadRequestException('Invalid user ID');
    return new Types.ObjectId(value);
  }

  private metricObjectId(value: string) {
    if (!Types.ObjectId.isValid(value))
      throw new BadRequestException('Invalid metric ID');
    return new Types.ObjectId(value);
  }

  private assertValidValuesForType(
    metricType: MetricType,
    values: Record<string, number>,
  ) {
    const required = REQUIRED_KEYS_BY_TYPE[metricType];
    const entries = Object.entries(values ?? {});
    if (
      !required ||
      entries.length !== required.length ||
      !entries.every(
        ([key, value]) =>
          required.includes(key) &&
          typeof value === 'number' &&
          Number.isFinite(value) &&
          value >= 0,
      )
    )
      throw new BadRequestException(
        `values for ${metricType} must contain exactly: ${required?.join(', ') ?? ''}`,
      );
  }

  private sameCorrection(
    metric: HealthMetricDocument,
    dto: CorrectHealthMetricDto,
  ) {
    return (
      metric.recordedAt.getTime() === new Date(dto.recordedAt).getTime() &&
      JSON.stringify(metric.values) === JSON.stringify(dto.values) &&
      (metric.recordedTimezone ?? 'UTC') ===
        (dto.recordedTimezone ?? metric.recordedTimezone ?? 'UTC')
    );
  }

  private extractMetricNumericValue(
    metricType: MetricType,
    values: Record<string, number>,
  ) {
    const value = values[PRIMARY_VALUE_KEY_BY_TYPE[metricType]];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private async createBmiFromLatestMetrics(
    patientId: Types.ObjectId,
    recordedAt: Date,
  ) {
    const baseFilter = {
      'meta.patientId': patientId,
      validationStatus: HealthMetricValidationStatus.VALID,
    };
    const [height, weight] = await Promise.all([
      this.healthMetricModel
        .findOne({ ...baseFilter, 'meta.metricType': MetricType.HEIGHT })
        .sort({ recordedAt: -1, _id: -1 })
        .lean()
        .exec(),
      this.healthMetricModel
        .findOne({ ...baseFilter, 'meta.metricType': MetricType.WEIGHT })
        .sort({ recordedAt: -1, _id: -1 })
        .lean()
        .exec(),
    ]);
    if (!height || !weight) return;
    const rawHeight = this.extractMetricNumericValue(
      MetricType.HEIGHT,
      height.values,
    );
    const rawWeight = this.extractMetricNumericValue(
      MetricType.WEIGHT,
      weight.values,
    );
    const heightMeters =
      height.meta.unit.toLowerCase() === 'cm' ? rawHeight / 100 : rawHeight;
    const weightKg = ['lb', 'lbs'].includes(weight.meta.unit.toLowerCase())
      ? rawWeight * 0.45359237
      : rawWeight;
    if (heightMeters <= 0 || weightKg <= 0) return;
    const bmi = Math.round((weightKg / heightMeters ** 2) * 100) / 100;
    await this.healthMetricModel.create({
      meta: { patientId, metricType: MetricType.BMI, unit: BMI_UNIT },
      values: { value: bmi },
      source: HealthMetricSource.IMPORT,
      sourceRef: { enteredBy: patientId },
      validationStatus: HealthMetricValidationStatus.VALID,
      validationReasonCodes: ['derived_from_height_weight'],
      recordedTimezone: 'UTC',
      recordedAt,
      ingestedAt: new Date(),
    });
  }

  private resolveUnitForType(metricType: MetricType) {
    const unit = DEFAULT_UNIT_BY_TYPE[metricType];
    if (!unit)
      throw new BadRequestException(
        `No unit configuration found for type ${metricType}`,
      );
    return unit;
  }

  private toDto(metric: HealthMetric & { _id: Types.ObjectId }) {
    return {
      id: String(metric._id),
      patientId: String(metric.meta.patientId),
      metricType: metric.meta.metricType,
      unit: metric.meta.unit,
      values: metric.values,
      source: metric.source,
      ...(metric.sourceRef ? { sourceRef: metric.sourceRef } : {}),
      validationStatus: metric.validationStatus,
      validationReasonCodes: metric.validationReasonCodes,
      ...(metric.recordedTimezone
        ? { recordedTimezone: metric.recordedTimezone }
        : {}),
      ...(metric.replacesMetricId
        ? { replacesMetricId: String(metric.replacesMetricId) }
        : {}),
      recordedAt: metric.recordedAt,
      ingestedAt: metric.ingestedAt,
      ...(metric.voidedAt ? { voidedAt: metric.voidedAt } : {}),
      ...(metric.voidReason ? { voidReason: metric.voidReason } : {}),
      createdAt: metric.createdAt,
    };
  }
}
