import { createConnection, type Connection, Types } from 'mongoose';
import {
  OutboxEvent,
  OutboxEventSchema,
} from '../src/infrastructure/outbox/entities/outbox-event.entity';
import { OutboxService } from '../src/infrastructure/outbox/outbox.service';
import {
  AuditLog,
  AuditLogSchema,
} from '../src/modules/platform-audit/domain/entities/audit-log.entity';
import {
  HealthMetric,
  HealthMetricSchema,
  MetricType,
} from '../src/modules/health-tracking/domain/entities/health-metric.entity';
import { HealthMetricsService } from '../src/modules/health-tracking/application/services/health-metrics.service';

jest.setTimeout(30_000);
const baseUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_cc003a?replicaSet=rs0&directConnection=true';

describe('CC-003A metric and outbox transaction', () => {
  let connection: Connection;
  const patientId = new Types.ObjectId();

  beforeAll(async () => {
    const uri = new URL(baseUri);
    uri.pathname = `/healthcare_cc003a_${new Types.ObjectId().toHexString()}`;
    connection = await createConnection(uri.toString(), {
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    connection.model(HealthMetric.name, HealthMetricSchema);
    connection.model(AuditLog.name, AuditLogSchema);
    connection.model(OutboxEvent.name, OutboxEventSchema);
  });
  afterAll(async () => {
    if (connection) {
      await connection.dropDatabase();
      await connection.close();
    }
  });

  function service(outbox: OutboxService) {
    return new HealthMetricsService(
      connection.model(HealthMetric.name) as never,
      connection.model(AuditLog.name) as never,
      connection,
      {} as never,
      {} as never,
      {} as never,
      { evaluateAndNotify: async () => undefined } as never,
      outbox,
    );
  }

  it('records an ID-only event in the same transaction as the metric', async () => {
    const result = await service(
      new OutboxService(connection.model(OutboxEvent.name) as never),
    ).create(String(patientId), {
      metricType: MetricType.BLOOD_PRESSURE,
      values: { systolic: 180, diastolic: 110 },
    });
    const event = await connection
      .model<OutboxEvent>(OutboxEvent.name)
      .findOne({ eventType: 'health.metric.recorded' })
      .lean()
      .exec();
    expect(event?.payload).toEqual({ metricId: result.data.id });
    expect(
      await connection
        .model(HealthMetric.name)
        .countDocuments({ _id: result.data.id }),
    ).toBe(1);
  });

  it('rolls the metric back when enqueue fails', async () => {
    const before = await connection.model(HealthMetric.name).countDocuments();
    const failing = {
      enqueue: async () => {
        throw new Error('outbox failure');
      },
    } as unknown as OutboxService;
    await expect(
      service(failing).create(String(patientId), {
        metricType: MetricType.HEART_RATE,
        values: { value: 80 },
      }),
    ).rejects.toThrow('outbox failure');
    expect(await connection.model(HealthMetric.name).countDocuments()).toBe(
      before,
    );
  });

  it('records one replacement event when a correction is replayed', async () => {
    const metricService = service(
      new OutboxService(connection.model(OutboxEvent.name) as never),
    );
    const original = await metricService.create(String(patientId), {
      metricType: MetricType.HEART_RATE,
      values: { value: 75 },
    });
    const input = {
      values: { value: 90 },
      recordedAt: original.data.recordedAt,
      reason: 'Correct measurement',
    };
    const corrected = await metricService.correct(
      String(patientId),
      original.data.id,
      input,
    );
    await metricService.correct(String(patientId), original.data.id, input);
    expect(
      await connection
        .model(OutboxEvent.name)
        .countDocuments({
          idempotencyKey: `health.metric.recorded.${corrected.data.id}`,
        }),
    ).toBe(1);
  });
});
