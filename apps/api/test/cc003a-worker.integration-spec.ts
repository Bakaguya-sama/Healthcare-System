import { createConnection, type Connection, Types } from 'mongoose';
import { createNodeRedisClient, Queue } from 'bullmq';
import { createClient } from 'redis';
import {
  OutboxEvent,
  OutboxEventSchema,
} from '../src/infrastructure/outbox/entities/outbox-event.entity';
import { OutboxService } from '../src/infrastructure/outbox/outbox.service';
import { OutboxWorkerService } from '../src/infrastructure/outbox/outbox-worker.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import {
  AuditLog,
  AuditLogSchema,
} from '../src/modules/platform-audit/domain/entities/audit-log.entity';
import {
  Notification,
  NotificationSchema,
} from '../src/modules/notifications/domain/entities/notification.entity';
import { NotificationsService } from '../src/modules/notifications/application/services/notifications.service';
import {
  HealthMetric,
  HealthMetricSchema,
  MetricType,
} from '../src/modules/health-tracking/domain/entities/health-metric.entity';
import { HealthMetricQueryService } from '../src/modules/health-tracking/application/services/health-metric-query.service';
import { HealthMetricsService } from '../src/modules/health-tracking/application/services/health-metrics.service';
import {
  CareAlert,
  CareAlertSchema,
} from '../src/modules/chronic-care/domain/entities/care-alert.entity';
import {
  HealthEvaluation,
  HealthEvaluationSchema,
} from '../src/modules/chronic-care/domain/entities/health-evaluation.entity';
import {
  PatientCareProgram,
  PatientCareProgramSchema,
} from '../src/modules/chronic-care/domain/entities/patient-care-program.entity';
import { CareAlertService } from '../src/modules/chronic-care/application/services/care-alert.service';
import { HealthEvaluationService } from '../src/modules/chronic-care/application/services/health-evaluation.service';
import { CareMetricEvaluationService } from '../src/modules/chronic-care/application/services/care-metric-evaluation.service';
import { CareTaskReminderService } from '../src/modules/chronic-care/application/services/care-task-reminder.service';
import { CareTaskSchedulerService } from '../src/modules/chronic-care/application/services/care-task-scheduler.service';
import { OutboxCareTaskQueue } from '../src/modules/chronic-care/infrastructure/adapters/outbox-care-task-queue.adapter';
import {
  CareTask,
  CareTaskSchema,
} from '../src/modules/chronic-care/domain/entities/care-task.entity';
import { STANDARD_CARE_PROGRAMS } from '../src/modules/chronic-care/domain/catalog/standard-care-programs';

jest.setTimeout(60_000);
const baseUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_cc003a?replicaSet=rs0&directConnection=true';
const redisUrl = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:16379/12';

describe('CC-003A worker pipeline', () => {
  let connection: Connection;
  let worker: OutboxWorkerService;
  let redis: RedisService;
  let metrics: HealthMetricsService;
  let alerts: CareAlertService;
  let outbox: OutboxService;
  const patientId = new Types.ObjectId();
  const doctorId = new Types.ObjectId();
  const ruleId = new Types.ObjectId();
  const enrollmentId = new Types.ObjectId();
  const prefix = `cc003atest${new Types.ObjectId().toHexString()}`;

  beforeAll(async () => {
    const uri = new URL(baseUri);
    uri.pathname = `/healthcare_cc003a_worker_${new Types.ObjectId().toHexString()}`;
    connection = await createConnection(uri.toString(), {
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    const metricModel = connection.model(HealthMetric.name, HealthMetricSchema);
    const eventModel = connection.model(OutboxEvent.name, OutboxEventSchema);
    const auditModel = connection.model(AuditLog.name, AuditLogSchema);
    const alertModel = connection.model(CareAlert.name, CareAlertSchema);
    const evaluationModel = connection.model(
      HealthEvaluation.name,
      HealthEvaluationSchema,
    );
    const enrollmentModel = connection.model(
      PatientCareProgram.name,
      PatientCareProgramSchema,
    );
    const taskModel = connection.model(CareTask.name, CareTaskSchema);
    const notificationModel = connection.model(
      Notification.name,
      NotificationSchema,
    );
    await Promise.all([
      eventModel.init(),
      auditModel.init(),
      alertModel.init(),
      evaluationModel.init(),
      notificationModel.init(),
    ]);
    await enrollmentModel.collection.insertOne({
      _id: enrollmentId,
      patientId,
      doctorId,
      status: 'active',
      timezone: 'Asia/Ho_Chi_Minh',
      programConfig: {
        taskTemplates: STANDARD_CARE_PROGRAMS[0].taskTemplates,
        ruleSnapshot: {
          careRuleId: String(ruleId),
          version: 1,
          revision: 1,
          rules: STANDARD_CARE_PROGRAMS[0].rules,
        },
      },
    });
    const config = {
      get: (key: string) =>
        key === 'CARE_MONITORING_AUTOMATION_ENABLED'
          ? true
          : key === 'OUTBOX_QUEUE_PREFIX'
            ? prefix
            : undefined,
      getOrThrow: (key: string) => (key === 'REDIS_URL' ? redisUrl : 1500),
    } as never;
    const redisClient = createClient({ url: redisUrl });
    redis = new RedisService(redisClient as never, config);
    await redis.onModuleInit();
    outbox = new OutboxService(eventModel as never);
    const notifications = new NotificationsService(
      notificationModel as never,
      outbox,
      connection,
    );
    const queries = new HealthMetricQueryService(metricModel as never);
    alerts = new CareAlertService(
      alertModel as never,
      evaluationModel as never,
      enrollmentModel as never,
      auditModel as never,
      connection,
      outbox,
    );
    const evaluations = new HealthEvaluationService(
      enrollmentModel as never,
      evaluationModel as never,
      alerts,
    );
    const careMetrics = new CareMetricEvaluationService(
      queries,
      enrollmentModel as never,
      evaluations,
    );
    const reminders = new CareTaskReminderService(
      taskModel as never,
      enrollmentModel as never,
    );
    const scheduler = new CareTaskSchedulerService(
      taskModel as never,
      enrollmentModel as never,
      new OutboxCareTaskQueue(outbox),
      queries,
      evaluations,
    );
    metrics = new HealthMetricsService(
      metricModel as never,
      auditModel as never,
      connection,
      {} as never,
      {} as never,
      queries,
      { evaluateAndNotify: async () => undefined } as never,
      outbox,
    );
    worker = new OutboxWorkerService(
      config,
      outbox,
      redis,
      notifications,
      scheduler,
      reminders,
      careMetrics,
      { recover: async () => undefined } as never,
      { grantForPaidOrder: async () => undefined } as never,
    );
    await worker.onModuleInit();
  });

  afterAll(async () => {
    if (worker) await worker.onApplicationShutdown();
    const queue = new Queue('healthcare-outbox', {
      prefix,
      connection: createNodeRedisClient(redis.client as never),
    });
    await queue.obliterate({ force: true });
    await queue.close();
    if (redis) await redis.onApplicationShutdown();
    if (connection) {
      await connection.dropDatabase();
      await connection.close();
    }
  });

  it('processes real metric events, escalates attention to urgent and persists the safety notification', async () => {
    await metrics.create(String(patientId), {
      metricType: MetricType.BLOOD_PRESSURE,
      values: { systolic: 120, diastolic: 80 },
    });
    await waitFor(
      async () =>
        (await connection.model(HealthEvaluation.name).countDocuments()) === 1,
    );
    expect(await connection.model(CareAlert.name).countDocuments()).toBe(0);
    await metrics.create(String(patientId), {
      metricType: MetricType.BLOOD_PRESSURE,
      values: { systolic: 150, diastolic: 90 },
    });
    await waitFor(
      async () =>
        (await connection
          .model(CareAlert.name)
          .countDocuments({ severity: 'attention' })) === 1,
    );
    const alertFailure = jest
      .spyOn(alerts, 'createForEvaluation')
      .mockRejectedValueOnce(new Error('simulated alert failure'));
    const urgentMetric = await metrics.create(String(patientId), {
      metricType: MetricType.BLOOD_PRESSURE,
      values: { systolic: 180, diastolic: 110 },
    });
    await waitFor(
      async () =>
        (await connection
          .model(Notification.name)
          .countDocuments({ type: 'critical' })) === 1,
    );
    expect(
      await connection
        .model(CareAlert.name)
        .countDocuments({ severity: 'urgent' }),
    ).toBe(1);
    expect(await connection.model(HealthEvaluation.name).countDocuments()).toBe(
      3,
    );
    const event = await connection
      .model<OutboxEvent>(OutboxEvent.name)
      .findOne({
        idempotencyKey: `health.metric.recorded.${urgentMetric.data.id}`,
      })
      .lean();
    expect(event?.attemptCount).toBeGreaterThanOrEqual(1);
    alertFailure.mockRestore();
  });

  it('delivers a due reminder but skips a cancelled task', async () => {
    const dueId = new Types.ObjectId();
    const cancelledId = new Types.ObjectId();
    const dueAt = new Date(Date.now() + 2_000);
    for (const [id, status] of [
      [dueId, 'due'],
      [cancelledId, 'cancelled'],
    ] as const) {
      await connection.model(CareTask.name).collection.insertOne({
        _id: id,
        uniqueKey: `cc003a-test-task.${String(id)}`,
        patientId,
        patientCareProgramId: enrollmentId,
        status,
        windowStart: new Date(Date.now() - 1_000),
        windowEnd: new Date(Date.now() + 60_000),
      });
      await outbox.enqueue({
        eventType: 'care.task.reminder',
        aggregateType: 'careTask',
        aggregateId: id,
        idempotencyKey: `care.task.reminder.${String(id)}`,
        availableAt: dueAt,
        payload: {
          taskId: String(id),
          patientId: String(patientId),
          scheduledFor: dueAt.toISOString(),
        },
      });
    }
    expect(
      await connection.model(Notification.name).countDocuments({
        idempotencyKey: `care.task.reminder.${String(dueId)}`,
      }),
    ).toBe(0);
    await waitFor(
      async () =>
        (await connection.model<OutboxEvent>(OutboxEvent.name).countDocuments({
          idempotencyKey: {
            $in: [
              `care.task.reminder.${String(dueId)}`,
              `care.task.reminder.${String(cancelledId)}`,
            ],
          },
          status: 'delivered',
        })) === 2,
    );
    expect(
      await connection.model(Notification.name).countDocuments({
        idempotencyKey: `care.task.reminder.${String(dueId)}`,
      }),
    ).toBe(1);
    expect(
      await connection.model(Notification.name).countDocuments({
        idempotencyKey: `care.task.reminder.${String(cancelledId)}`,
      }),
    ).toBe(0);
  });

  it('delivers durable CC-013B timeout warnings to both consultation participants', async () => {
    const consultationId = new Types.ObjectId();
    const warningPatientId = new Types.ObjectId();
    const warningDoctorId = new Types.ObjectId();
    await outbox.enqueue({
      eventType: 'consultation.on-demand-timeout-warning',
      aggregateType: 'Consultation',
      aggregateId: consultationId,
      idempotencyKey: `consultation.timeout-warning:${String(consultationId)}`,
      payload: {
        consultationId: String(consultationId),
        patientId: String(warningPatientId),
        doctorId: String(warningDoctorId),
      },
    });
    await waitFor(async () =>
      Boolean(
        await connection.model<OutboxEvent>(OutboxEvent.name).exists({
          idempotencyKey: `consultation.timeout-warning:${String(consultationId)}`,
          status: 'delivered',
        }),
      ),
    );
    expect(
      await connection.model(Notification.name).countDocuments({
        idempotencyKey: {
          $in: [
            `consultation.on-demand-timeout-warning.${String(consultationId)}.${String(warningPatientId)}`,
            `consultation.on-demand-timeout-warning.${String(consultationId)}.${String(warningDoctorId)}`,
          ],
        },
      }),
    ).toBe(2);
  });

  it('replays a dead metric event without duplicating its evaluation', async () => {
    await worker.onApplicationShutdown();
    const metric = await metrics.create(String(patientId), {
      metricType: MetricType.BLOOD_PRESSURE,
      values: { systolic: 180, diastolic: 110 },
    });
    const key = `health.metric.recorded.${metric.data.id}`;
    await connection
      .model<OutboxEvent>(OutboxEvent.name)
      .updateOne({ idempotencyKey: key }, { $set: { maxAttempts: 1 } });
    const failure = jest
      .spyOn(alerts, 'createForEvaluation')
      .mockRejectedValue(new Error('simulated persistent failure'));
    await worker.onModuleInit();
    await waitFor(async () =>
      Boolean(
        await connection
          .model<OutboxEvent>(OutboxEvent.name)
          .exists({ idempotencyKey: key, status: 'dead' }),
      ),
    );
    const dead = await connection
      .model<OutboxEvent>(OutboxEvent.name)
      .findOne({ idempotencyKey: key })
      .lean();
    expect(dead).not.toBeNull();
    failure.mockRestore();
    await outbox.requeueDead(String(dead!._id));
    await waitFor(async () =>
      Boolean(
        await connection
          .model<OutboxEvent>(OutboxEvent.name)
          .exists({ idempotencyKey: key, status: 'delivered' }),
      ),
    );
    expect(
      await connection
        .model(HealthEvaluation.name)
        .countDocuments({ healthMetricId: new Types.ObjectId(metric.data.id) }),
    ).toBe(1);
  });

  it('recovers an event left in processing after a worker crash', async () => {
    await worker.onApplicationShutdown();
    const metric = await metrics.create(String(patientId), {
      metricType: MetricType.BLOOD_PRESSURE,
      values: { systolic: 150, diastolic: 90 },
    });
    const key = `health.metric.recorded.${metric.data.id}`;
    const [claimed] = await outbox.claimBatch(1, 30_000);
    expect(claimed.idempotencyKey).toBe(key);
    await connection
      .model<OutboxEvent>(OutboxEvent.name)
      .updateOne(
        { _id: claimed._id },
        { $set: { lockExpiresAt: new Date(Date.now() - 1) } },
      );

    await worker.onModuleInit();
    await waitFor(async () =>
      Boolean(
        await connection
          .model<OutboxEvent>(OutboxEvent.name)
          .exists({ idempotencyKey: key, status: 'delivered' }),
      ),
    );
    expect(
      await connection
        .model(HealthEvaluation.name)
        .countDocuments({ healthMetricId: new Types.ObjectId(metric.data.id) }),
    ).toBe(1);
  });
});

async function waitFor(check: () => Promise<boolean>) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for worker');
}
