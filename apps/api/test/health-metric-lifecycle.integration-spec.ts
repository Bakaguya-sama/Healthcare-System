import { ConflictException } from '@nestjs/common';
import { createConnection, type Connection, Types } from 'mongoose';
import {
  AuditLog,
  AuditLogSchema,
} from '../src/modules/platform-audit/domain/entities/audit-log.entity';
import {
  HealthMetric,
  HealthMetricSchema,
  HealthMetricSource,
  HealthMetricValidationStatus,
  MetricType,
} from '../src/modules/health-tracking/domain/entities/health-metric.entity';
import { HealthMetricsService } from '../src/modules/health-tracking/application/services/health-metrics.service';
import { HealthMetricQueryService } from '../src/modules/health-tracking/application/services/health-metric-query.service';

const mongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_health_metric_lifecycle?replicaSet=rs0&directConnection=true';

describe('HealthMetric correction and void lifecycle', () => {
  let connection: Connection;
  let service: HealthMetricsService;
  let queries: HealthMetricQueryService;
  const patientId = new Types.ObjectId();
  const evaluateAndNotify = jest.fn().mockResolvedValue(null);

  beforeAll(async () => {
    connection = await createConnection(mongoUri).asPromise();
    const metricModel = connection.model(HealthMetric.name, HealthMetricSchema);
    const auditModel = connection.model(AuditLog.name, AuditLogSchema);
    queries = new HealthMetricQueryService(metricModel as never);
    service = new HealthMetricsService(
      metricModel as never,
      auditModel as never,
      connection,
      {} as never,
      {} as never,
      {} as never,
      { evaluateAndNotify } as never,
    );
  });

  beforeEach(async () => {
    await connection.dropDatabase();
    evaluateAndNotify.mockClear();
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  it('creates one append-only correction, supersedes the original and replays safely', async () => {
    const original = await connection.model(HealthMetric.name).create({
      meta: {
        patientId,
        metricType: MetricType.BLOOD_PRESSURE,
        unit: 'mmHg',
      },
      values: { systolic: 150, diastolic: 95 },
      source: HealthMetricSource.MANUAL,
      sourceRef: { enteredBy: patientId },
      validationStatus: HealthMetricValidationStatus.VALID,
      validationReasonCodes: [],
      recordedTimezone: 'Asia/Ho_Chi_Minh',
      recordedAt: new Date('2026-10-01T01:00:00.000Z'),
      ingestedAt: new Date('2026-10-01T01:01:00.000Z'),
    });
    const input = {
      values: { systolic: 120, diastolic: 80 },
      recordedAt: new Date('2026-10-01T01:00:00.000Z'),
      recordedTimezone: 'Asia/Ho_Chi_Minh',
      reason: 'Corrected an input mistake',
    };

    const [corrected, replay] = await Promise.all([
      service.correct(patientId.toHexString(), String(original._id), input),
      service.correct(patientId.toHexString(), String(original._id), input),
    ]);

    expect(replay.data.id).toBe(corrected.data.id);
    expect(await connection.model(HealthMetric.name).countDocuments()).toBe(2);
    expect(
      await connection.model(HealthMetric.name).findById(original._id).lean(),
    ).toMatchObject({
      validationStatus: HealthMetricValidationStatus.SUPERSEDED,
    });
    expect(evaluateAndNotify).toHaveBeenCalledTimes(1);
    const beforeCorrection = await queries.listRecordedInWindow({
      patientId: patientId.toHexString(),
      from: new Date('2026-10-01T00:00:00.000Z'),
      to: new Date('2026-10-02T00:00:00.000Z'),
      ingestedUntil: new Date('2026-10-02T00:00:00.000Z'),
      limit: 100,
    });
    const afterCorrection = await queries.listRecordedInWindow({
      patientId: patientId.toHexString(),
      from: new Date('2026-10-01T00:00:00.000Z'),
      to: new Date('2026-10-02T00:00:00.000Z'),
      ingestedUntil: new Date('2100-01-01T00:00:00.000Z'),
      limit: 100,
    });
    expect(beforeCorrection.items).toEqual([
      expect.objectContaining({
        id: String(original._id),
        values: { systolic: 150, diastolic: 95 },
      }),
    ]);
    expect(afterCorrection.items).toEqual([
      expect.objectContaining({
        id: corrected.data.id,
        values: { systolic: 120, diastolic: 80 },
      }),
    ]);
    await expect(
      service.correct(patientId.toHexString(), String(original._id), {
        ...input,
        values: { systolic: 130, diastolic: 85 },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('voids without deleting and records an audit entry idempotently', async () => {
    const metric = await connection.model(HealthMetric.name).create({
      meta: {
        patientId,
        metricType: MetricType.HEART_RATE,
        unit: 'bpm',
      },
      values: { value: 70 },
      source: HealthMetricSource.MANUAL,
      validationStatus: HealthMetricValidationStatus.VALID,
      validationReasonCodes: [],
      recordedAt: new Date(),
      ingestedAt: new Date(),
    });
    const first = await service.void(
      patientId.toHexString(),
      String(metric._id),
      'Entered for the wrong patient',
    );
    const replay = await service.void(
      patientId.toHexString(),
      String(metric._id),
      'Entered for the wrong patient',
    );

    expect(replay.data.id).toBe(first.data.id);
    expect(await connection.model(HealthMetric.name).countDocuments()).toBe(1);
    expect(first.data).toMatchObject({
      validationStatus: HealthMetricValidationStatus.VOIDED,
      voidReason: 'Entered for the wrong patient',
    });
    expect(await connection.model(AuditLog.name).countDocuments()).toBe(1);
  });
});
