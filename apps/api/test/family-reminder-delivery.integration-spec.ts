import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { Connection, createConnection, Model, Types } from 'mongoose';
import { migrateDatabase } from '../src/database/migrations/run-migrations';
import { verifyDatabase } from '../src/database/verify-database';
import {
  FamilyLink,
  FamilyLinkDocument,
  FamilyLinkSchema,
} from '../src/modules/family-companion/infrastructure/mongoose/family-link.schema';
import {
  FamilyPermission,
  FamilyPermissionDocument,
  FamilyPermissionSchema,
} from '../src/modules/family-companion/infrastructure/mongoose/family-permission.schema';
import {
  FamilyReminder,
  FamilyReminderDocument,
  FamilyReminderSchema,
} from '../src/modules/family-companion/infrastructure/mongoose/family-reminder.schema';
import {
  FamilyReminderQuota,
  FamilyReminderQuotaDocument,
  FamilyReminderQuotaSchema,
} from '../src/modules/family-companion/infrastructure/mongoose/family-reminder-quota.schema';
import {
  Notification,
  NotificationDocument,
  NotificationSchema,
} from '../src/modules/notifications/domain/entities/notification.entity';
import {
  OutboxEvent,
  OutboxEventDocument,
  OutboxEventSchema,
} from '../src/infrastructure/outbox/entities/outbox-event.entity';
import { OutboxService } from '../src/infrastructure/outbox/outbox.service';
import { NotificationsService } from '../src/modules/notifications/application/services/notifications.service';
import { MongooseFamilyReminderDeliveryStore } from '../src/modules/family-companion/infrastructure/mongoose/mongoose-family-reminder-delivery.store';
import {
  CareTask,
  CareTaskDocument,
  CareTaskSchema,
} from '../src/modules/chronic-care/domain/entities/care-task.entity';
import {
  PatientCareProgram,
  PatientCareProgramDocument,
  PatientCareProgramSchema,
} from '../src/modules/chronic-care/domain/entities/patient-care-program.entity';
import { MongooseCareTaskReminderReaderAdapter } from '../src/modules/chronic-care/infrastructure/adapters/mongoose-care-task-reminder-reader.adapter';
import { CareTaskReminderService } from '../src/modules/chronic-care/application/services/care-task-reminder.service';
import { PatientTaskReminderOutboxAdapter } from '../src/modules/family-companion/infrastructure/outbox/patient-task-reminder-outbox.adapter';
import { OutboxWorkerService } from '../src/infrastructure/outbox/outbox-worker.service';

jest.setTimeout(120_000);

describe('Family reminder delivery persistence (MongoDB replica set)', () => {
  let connection: Connection;
  let testDatabaseName: string;
  let links: Model<FamilyLinkDocument>;
  let permissions: Model<FamilyPermissionDocument>;
  let reminders: Model<FamilyReminderDocument>;
  let quotas: Model<FamilyReminderQuotaDocument>;
  let notifications: Model<NotificationDocument>;
  let outboxEvents: Model<OutboxEventDocument>;
  let tasks: Model<CareTaskDocument>;
  let enrollments: Model<PatientCareProgramDocument>;
  let outbox: OutboxService;
  let notificationsService: NotificationsService;
  let store: MongooseFamilyReminderDeliveryStore;

  beforeAll(async () => {
    const uri = new URL(
      process.env.TEST_MONGODB_URI ??
        'mongodb://127.0.0.1:27018/healthcare_family_test?replicaSet=rs0&directConnection=true',
    );
    testDatabaseName = `fc_${randomUUID().replaceAll('-', '')}`;
    uri.pathname = `/${testDatabaseName}`;
    const client = new MongoClient(uri.toString());
    try {
      await client.connect();
      await migrateDatabase(client.db());
      await migrateDatabase(client.db());
      await verifyDatabase(client.db());
    } catch (error) {
      if (/^fc_[a-f0-9]{32}$/.test(testDatabaseName)) {
        try {
          await client.db(testDatabaseName).dropDatabase();
        } catch {
          /* Preserve the migration or verifier failure. */
        }
      }
      throw error;
    } finally {
      await client.close();
    }

    connection = await createConnection(uri.toString(), {
      autoIndex: true,
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    links = connection.model(
      FamilyLink.name,
      FamilyLinkSchema,
    ) as unknown as Model<FamilyLinkDocument>;
    permissions = connection.model(
      FamilyPermission.name,
      FamilyPermissionSchema,
    ) as unknown as Model<FamilyPermissionDocument>;
    reminders = connection.model(
      FamilyReminder.name,
      FamilyReminderSchema,
    ) as unknown as Model<FamilyReminderDocument>;
    quotas = connection.model(
      FamilyReminderQuota.name,
      FamilyReminderQuotaSchema,
    ) as unknown as Model<FamilyReminderQuotaDocument>;
    notifications = connection.model(
      Notification.name,
      NotificationSchema,
    ) as unknown as Model<NotificationDocument>;
    outboxEvents = connection.model(
      OutboxEvent.name,
      OutboxEventSchema,
    ) as unknown as Model<OutboxEventDocument>;
    tasks = connection.model(
      CareTask.name,
      CareTaskSchema,
    ) as unknown as Model<CareTaskDocument>;
    enrollments = connection.model(
      PatientCareProgram.name,
      PatientCareProgramSchema,
    ) as unknown as Model<PatientCareProgramDocument>;
    outbox = new OutboxService(outboxEvents);
    notificationsService = new NotificationsService(
      notifications,
      outbox,
      connection,
    );
    store = new MongooseFamilyReminderDeliveryStore(
      reminders,
      links,
      permissions,
      quotas,
      notificationsService,
      outbox,
      connection,
      new MongooseCareTaskReminderReaderAdapter(tasks, enrollments),
    );
  });

  afterAll(async () => {
    await connection?.close();
    if (testDatabaseName && /^fc_[a-f0-9]{32}$/.test(testDatabaseName)) {
      const client = new MongoClient(
        process.env.TEST_MONGODB_URI ??
          'mongodb://127.0.0.1:27018/healthcare_family_test?replicaSet=rs0&directConnection=true',
      );
      try {
        await client.connect();
        await client.db(testDatabaseName).dropDatabase();
      } finally {
        await client.close();
      }
    }
  });

  beforeEach(async () => {
    await Promise.all([
      links.deleteMany({}),
      permissions.deleteMany({}),
      reminders.deleteMany({}),
      quotas.deleteMany({}),
      notifications.deleteMany({}),
      outboxEvents.deleteMany({}),
      tasks.deleteMany({}),
      enrollments.deleteMany({}),
    ]);
  });

  async function createMissedReminder(companionUserId: Types.ObjectId) {
    const patientId = new Types.ObjectId();
    const linkId = new Types.ObjectId();
    const permissionId = new Types.ObjectId();
    const taskId = new Types.ObjectId();
    const enrollmentId = new Types.ObjectId();
    const doctorId = new Types.ObjectId();
    const missedAt = new Date(Date.now() - 60_000);
    await enrollments.create({
      _id: enrollmentId,
      revision: 1,
      patientId,
      doctorId,
      careProgramId: new Types.ObjectId(),
      careRuleId: new Types.ObjectId(),
      status: 'active',
      timezone: 'Asia/Ho_Chi_Minh',
      consent: { version: 'synthetic.v1' },
      programConfig: { programCode: 'synthetic' },
      createdBy: doctorId,
    });
    await tasks.create({
      _id: taskId,
      patientCareProgramId: enrollmentId,
      patientId,
      templateKey: 'synthetic-task',
      taskType: 'check_in',
      status: 'missed',
      required: true,
      scheduleVersion: 'v1',
      scheduledFor: missedAt,
      windowStart: new Date(missedAt.getTime() - 60_000),
      windowEnd: missedAt,
      completionRule: { type: 'manual' },
      reminderPolicy: { enabled: true },
      missedAt,
      uniqueKey: `synthetic-missed-${taskId}`,
    });
    await links.create({
      _id: linkId,
      patientId,
      familyUserId: companionUserId,
      status: 'active',
      invitationVersion: 1,
      invitationDelivery: 'selected_contact',
      invitedAt: new Date(),
      invitationExpiresAt: new Date(Date.now() + 7 * 86_400_000),
      permissions: ['missed_task_reminder'],
    });
    await permissions.create({
      _id: permissionId,
      patientId,
      familyLinkId: linkId,
      policyVersion: 'family-companion.v1',
      permissions: ['missed_task_reminder'],
      status: 'active',
      grantedBy: patientId,
      grantedAt: new Date(),
    });
    const reminder = await reminders.create({
      patientId,
      familyLinkId: linkId,
      permissionId,
      careTaskId: taskId,
      reminderType: 'missed_task',
      uniqueKey: `synthetic.${new Types.ObjectId()}`,
      status: 'scheduled',
      scheduledAt: new Date(Date.now() - 1_000),
      patientTimeZone: 'Asia/Ho_Chi_Minh',
    });
    const dispatchEvent = await outboxEvents.create({
      eventType: 'family.reminder.dispatch.v1',
      aggregateType: 'FamilyReminder',
      aggregateId: reminder._id,
      payload: { familyReminderId: String(reminder._id) },
      idempotencyKey: `family.reminder.dispatch.${reminder.uniqueKey}`,
      status: 'processing',
      attemptCount: 0,
      maxAttempts: 8,
      nextAttemptAt: new Date(),
      lockedAt: new Date(),
      lockExpiresAt: new Date(Date.now() + 30_000),
    });
    return {
      reminder,
      patientId,
      linkId,
      taskId,
      permissionId,
      enrollmentId,
      dispatchEventId: dispatchEvent._id,
    };
  }

  it('allows only one of two concurrent task/link dispatches in the same rolling 24 hours', async () => {
    const companionId = new Types.ObjectId();
    const first = await createMissedReminder(companionId);
    const second = await createMissedReminder(companionId);
    const now = new Date();
    const results = await Promise.all([
      store.dispatchReminder({
        reminderId: String(first.reminder._id),
        outboxEventId: String(first.dispatchEventId),
        now,
        quotaWindowMs: 24 * 60 * 60 * 1000,
      }),
      store.dispatchReminder({
        reminderId: String(second.reminder._id),
        outboxEventId: String(second.dispatchEventId),
        now,
        quotaWindowMs: 24 * 60 * 60 * 1000,
      }),
    ]);
    expect(results.map((result) => result.outcome).sort()).toEqual([
      'dispatched',
      'quota_limited',
    ]);
    expect(await notifications.countDocuments({ userId: companionId })).toBe(1);
    expect(await quotas.countDocuments({ companionUserId: companionId })).toBe(
      1,
    );
    const dispatchedIndex = results.findIndex(
      (result) => result.outcome === 'dispatched',
    );
    const dispatchedEventId =
      dispatchedIndex === 0 ? first.dispatchEventId : second.dispatchEventId;
    const limitedEventId =
      dispatchedIndex === 0 ? second.dispatchEventId : first.dispatchEventId;
    expect(
      (await outboxEvents.findById(dispatchedEventId).lean())?.status,
    ).toBe('delivered');
    expect((await outboxEvents.findById(limitedEventId).lean())?.status).toBe(
      'processing',
    );
    expect(
      await reminders.countDocuments({
        _id: { $in: [first.reminder._id, second.reminder._id] },
        status: 'dispatched',
      }),
    ).toBe(1);
    await store.dispatchReminder({
      reminderId: String(first.reminder._id),
      outboxEventId: String(first.dispatchEventId),
      now: new Date(),
      quotaWindowMs: 24 * 60 * 60 * 1000,
    });
    expect(await notifications.countDocuments({ userId: companionId })).toBe(1);
  });

  it('persists the Patient missed-task notification through the real outbox worker before Companion eligibility', async () => {
    const { patientId, taskId } = await createMissedReminder(
      new Types.ObjectId(),
    );
    const patientReminderOutbox = new PatientTaskReminderOutboxAdapter(
      outbox,
      notificationsService,
    );
    await patientReminderOutbox.scheduleMissedTaskReminder({
      taskId: String(taskId),
      patientId: String(patientId),
      scheduledFor: new Date(Date.now() - 1_000),
    });
    const patientEvent = await outboxEvents.findOneAndUpdate(
      {
        idempotencyKey: `care.task.missed-reminder.${taskId}`,
      },
      { $set: { status: 'processing' } },
      { returnDocument: 'after' },
    );
    if (!patientEvent)
      throw new Error('Synthetic Patient reminder event missing');

    const worker = new OutboxWorkerService(
      {
        get: (key: string) =>
          key === 'CARE_MONITORING_AUTOMATION_ENABLED' ||
          key === 'FAMILY_COMPANION_ENABLED',
      } as never,
      outbox,
      {} as never,
      notificationsService,
      {} as never,
      new CareTaskReminderService(tasks, enrollments),
      {} as never,
      {} as never,
      {} as never,
    );

    await (worker as any).deliverEvent(String(patientEvent._id), 0, 8);

    expect(
      await notifications.countDocuments({
        idempotencyKey: `care.task.missed-reminder.${taskId}`,
        userId: patientId,
      }),
    ).toBe(1);
    expect((await outboxEvents.findById(patientEvent._id).lean())?.status).toBe(
      'delivered',
    );
    await expect(
      patientReminderOutbox.getPatientReminderState(String(taskId)),
    ).resolves.toBe('notified');

    await outboxEvents.updateOne(
      { _id: patientEvent._id },
      { $set: { status: 'processing' } },
    );
    await (worker as any).deliverEvent(String(patientEvent._id), 1, 8);
    expect(
      await notifications.countDocuments({
        idempotencyKey: `care.task.missed-reminder.${taskId}`,
        userId: patientId,
      }),
    ).toBe(1);
  });

  it('suppresses a reminder when its enrollment became inactive after scheduling', async () => {
    const { reminder, enrollmentId, dispatchEventId } =
      await createMissedReminder(new Types.ObjectId());
    await enrollments.updateOne(
      { _id: enrollmentId },
      { $set: { status: 'paused' } },
    );

    const result = await store.dispatchReminder({
      reminderId: String(reminder._id),
      outboxEventId: String(dispatchEventId),
      now: new Date(),
      quotaWindowMs: 24 * 60 * 60 * 1000,
    });

    expect(result).toEqual({
      outcome: 'skipped',
      reason: 'enrollment_not_active',
    });
    expect(await notifications.countDocuments({})).toBe(0);
    expect((await reminders.findById(reminder._id).lean())?.status).toBe(
      'skipped',
    );
    expect((await outboxEvents.findById(dispatchEventId).lean())?.status).toBe(
      'delivered',
    );
  });

  it('suppresses a reminder when its task stopped being missed after scheduling', async () => {
    const { reminder, taskId, dispatchEventId } = await createMissedReminder(
      new Types.ObjectId(),
    );
    await tasks.updateOne({ _id: taskId }, { $set: { status: 'completed' } });

    const result = await store.dispatchReminder({
      reminderId: String(reminder._id),
      outboxEventId: String(dispatchEventId),
      now: new Date(),
      quotaWindowMs: 24 * 60 * 60 * 1000,
    });

    expect(result).toEqual({ outcome: 'skipped', reason: 'task_not_missed' });
    expect(await notifications.countDocuments({})).toBe(0);
    expect((await outboxEvents.findById(dispatchEventId).lean())?.status).toBe(
      'delivered',
    );
  });

  it('rolls back quota reservation and notification when the notification outbox fails', async () => {
    const companionId = new Types.ObjectId();
    const { reminder, dispatchEventId } =
      await createMissedReminder(companionId);
    const failingOutbox = {
      enqueue: jest
        .fn()
        .mockRejectedValue(new Error('synthetic outbox failure')),
    } as unknown as OutboxService;
    const failingNotifications = new NotificationsService(
      notifications,
      failingOutbox,
      connection,
    );
    const failingStore = new MongooseFamilyReminderDeliveryStore(
      reminders,
      links,
      permissions,
      quotas,
      failingNotifications,
      failingOutbox,
      connection,
      new MongooseCareTaskReminderReaderAdapter(tasks, enrollments),
    );
    await expect(
      failingStore.dispatchReminder({
        reminderId: String(reminder._id),
        outboxEventId: String(dispatchEventId),
        now: new Date(),
        quotaWindowMs: 24 * 60 * 60 * 1000,
      }),
    ).rejects.toThrow('synthetic outbox failure');
    expect(await reminders.findById(reminder._id).lean()).toMatchObject({
      status: 'scheduled',
    });
    expect(
      (await quotas.findOne({ companionUserId: companionId }).lean())
        ?.lastMissedTaskDispatchedAt,
    ).toBeUndefined();
    expect(await notifications.countDocuments({ userId: companionId })).toBe(0);
  });

  it('rolls back notification, quota, reminder and outbox acknowledgement together', async () => {
    const companionId = new Types.ObjectId();
    const { reminder, dispatchEventId } =
      await createMissedReminder(companionId);
    const failingOutbox = {
      enqueue: jest.fn((...args: Parameters<OutboxService['enqueue']>) =>
        outbox.enqueue(...args),
      ),
      markDelivered: jest
        .fn()
        .mockRejectedValue(new Error('synthetic ack failure')),
    } as unknown as OutboxService;
    const transactionalNotifications = new NotificationsService(
      notifications,
      failingOutbox,
      connection,
    );
    const failingStore = new MongooseFamilyReminderDeliveryStore(
      reminders,
      links,
      permissions,
      quotas,
      transactionalNotifications,
      failingOutbox,
      connection,
      new MongooseCareTaskReminderReaderAdapter(tasks, enrollments),
    );

    await expect(
      failingStore.dispatchReminder({
        reminderId: String(reminder._id),
        outboxEventId: String(dispatchEventId),
        now: new Date(),
        quotaWindowMs: 24 * 60 * 60 * 1000,
      }),
    ).rejects.toThrow('synthetic ack failure');

    expect((await reminders.findById(reminder._id).lean())?.status).toBe(
      'scheduled',
    );
    expect((await outboxEvents.findById(dispatchEventId).lean())?.status).toBe(
      'processing',
    );
    expect(
      (await quotas.findOne({ companionUserId: companionId }).lean())
        ?.lastMissedTaskDispatchedAt,
    ).toBeUndefined();
    expect(await notifications.countDocuments({ userId: companionId })).toBe(0);
    expect(
      await outboxEvents.countDocuments({ eventType: 'notification.created' }),
    ).toBe(0);
  });

  it('rolls back a skip transition if its outbox acknowledgement fails', async () => {
    const { reminder, dispatchEventId } = await createMissedReminder(
      new Types.ObjectId(),
    );
    const failingOutbox = {
      markDelivered: jest
        .fn()
        .mockRejectedValue(new Error('synthetic skip ack failure')),
      getStatusById: jest.fn(),
    } as unknown as OutboxService;
    const failingStore = new MongooseFamilyReminderDeliveryStore(
      reminders,
      links,
      permissions,
      quotas,
      notificationsService,
      failingOutbox,
      connection,
      new MongooseCareTaskReminderReaderAdapter(tasks, enrollments),
    );

    await expect(
      failingStore.skipReminder(
        String(reminder._id),
        String(dispatchEventId),
        'task_not_missed',
      ),
    ).rejects.toThrow('synthetic skip ack failure');

    expect((await reminders.findById(reminder._id).lean())?.status).toBe(
      'scheduled',
    );
    expect((await outboxEvents.findById(dispatchEventId).lean())?.status).toBe(
      'processing',
    );
  });

  it('writes each scheduled reminder and its dispatch event atomically', async () => {
    const patientId = new Types.ObjectId();
    const companionId = new Types.ObjectId();
    const linkId = new Types.ObjectId();
    const permissionId = new Types.ObjectId();
    await links.create({
      _id: linkId,
      patientId,
      familyUserId: companionId,
      status: 'active',
      invitationVersion: 1,
      invitationDelivery: 'selected_contact',
      invitedAt: new Date(),
      invitationExpiresAt: new Date(Date.now() + 7 * 86_400_000),
      permissions: ['missed_task_reminder'],
    });
    const taskId = new Types.ObjectId();
    const uniqueKey = `schedule.${new Types.ObjectId()}`;
    await store.scheduleReminder({
      patientId: String(patientId),
      familyLinkId: String(linkId),
      permissionId: String(permissionId),
      careTaskId: String(taskId),
      reminderType: 'missed_task',
      uniqueKey,
      scheduledAt: new Date(Date.now() + 60_000),
      patientTimeZone: 'Asia/Ho_Chi_Minh',
    });
    expect(await reminders.countDocuments({ uniqueKey })).toBe(1);
    expect(
      await outboxEvents.countDocuments({
        idempotencyKey: `family.reminder.dispatch.${uniqueKey}`,
      }),
    ).toBe(1);
  });

  it('rolls back a scheduled reminder when creating its outbox event fails', async () => {
    const failingOutbox = {
      enqueue: jest
        .fn()
        .mockRejectedValue(new Error('synthetic outbox failure')),
    } as unknown as OutboxService;
    const failingStore = new MongooseFamilyReminderDeliveryStore(
      reminders,
      links,
      permissions,
      quotas,
      notificationsService,
      failingOutbox,
      connection,
      new MongooseCareTaskReminderReaderAdapter(tasks, enrollments),
    );
    const uniqueKey = `schedule-failure.${new Types.ObjectId()}`;
    await expect(
      failingStore.scheduleReminder({
        patientId: String(new Types.ObjectId()),
        familyLinkId: String(new Types.ObjectId()),
        permissionId: String(new Types.ObjectId()),
        careTaskId: String(new Types.ObjectId()),
        reminderType: 'missed_task',
        uniqueKey,
        scheduledAt: new Date(),
        patientTimeZone: 'Asia/Ho_Chi_Minh',
      }),
    ).rejects.toThrow('synthetic outbox failure');
    expect(await reminders.countDocuments({ uniqueKey })).toBe(0);
  });

  it('serializes concurrent schedule retries with one reminder and one dispatch event', async () => {
    const input = {
      patientId: String(new Types.ObjectId()),
      familyLinkId: String(new Types.ObjectId()),
      permissionId: String(new Types.ObjectId()),
      careTaskId: String(new Types.ObjectId()),
      reminderType: 'missed_task' as const,
      uniqueKey: `concurrent-schedule.${new Types.ObjectId()}`,
      scheduledAt: new Date(Date.now() + 60_000),
      patientTimeZone: 'Asia/Ho_Chi_Minh',
    };
    await Promise.all([
      store.scheduleReminder(input),
      store.scheduleReminder(input),
    ]);
    expect(await reminders.countDocuments({ uniqueKey: input.uniqueKey })).toBe(
      1,
    );
    expect(
      await outboxEvents.countDocuments({
        idempotencyKey: `family.reminder.dispatch.${input.uniqueKey}`,
      }),
    ).toBe(1);
  });

  it('updates reminder schedule and processing outbox event in one transaction', async () => {
    const { reminder } = await createMissedReminder(new Types.ObjectId());
    const outboxEvent = await outboxEvents.create({
      eventType: 'family.reminder.dispatch.v1',
      aggregateType: 'FamilyReminder',
      aggregateId: reminder._id,
      payload: { familyReminderId: String(reminder._id) },
      idempotencyKey: `defer.${new Types.ObjectId()}`,
      status: 'processing',
      attemptCount: 0,
      maxAttempts: 8,
      nextAttemptAt: new Date(),
      lockedAt: new Date(),
      lockExpiresAt: new Date(Date.now() + 30_000),
    });
    const scheduledAt = new Date(Date.now() + 5 * 60_000);
    await expect(
      store.deferDispatch(
        String(reminder._id),
        String(outboxEvent._id),
        scheduledAt,
      ),
    ).resolves.toBe(true);
    expect(
      (await reminders.findById(reminder._id).lean())?.scheduledAt,
    ).toEqual(scheduledAt);
    const updatedEvent = await outboxEvents.findById(outboxEvent._id).lean();
    expect(updatedEvent?.status).toBe('pending');
    expect(updatedEvent?.nextAttemptAt).toEqual(scheduledAt);
    expect(updatedEvent?.lockExpiresAt).toBeUndefined();
  });

  it('keyset-pages all missed tasks with tied timestamps and reads enrollment state', async () => {
    const reader = new MongooseCareTaskReminderReaderAdapter(
      tasks,
      enrollments,
    );
    const patientId = new Types.ObjectId();
    const enrollmentId = new Types.ObjectId();
    const doctorId = new Types.ObjectId();
    await enrollments.create({
      _id: enrollmentId,
      revision: 1,
      patientId,
      doctorId,
      careProgramId: new Types.ObjectId(),
      careRuleId: new Types.ObjectId(),
      status: 'active',
      timezone: 'Asia/Ho_Chi_Minh',
      consent: { version: 'synthetic.v1' },
      programConfig: { programCode: 'synthetic' },
      createdBy: doctorId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const missedAt = new Date('2026-11-24T00:00:00.000Z');
    await tasks.insertMany(
      Array.from({ length: 205 }, (_, index) => ({
        patientCareProgramId: enrollmentId,
        patientId,
        templateKey: 'synthetic-task',
        taskType: 'check_in',
        status: 'missed',
        required: true,
        scheduleVersion: 'v1',
        scheduledFor: missedAt,
        windowStart: missedAt,
        windowEnd: new Date(missedAt.getTime() + 60_000),
        completionRule: { type: 'manual' },
        reminderPolicy: { enabled: true },
        missedAt,
        uniqueKey: `synthetic-missed-${index}-${randomUUID()}`,
      })),
      { ordered: true },
    );
    const seen: string[] = [];
    let afterId: string | undefined;
    let hasMorePages = true;
    while (hasMorePages) {
      const page = await reader.findMissedTaskCandidates({
        afterId,
        missedBefore: new Date(missedAt.getTime() + 1),
        limit: 200,
      });
      seen.push(...page.tasks.map((task) => task.taskId));
      if (!page.nextCursor) {
        hasMorePages = false;
        continue;
      }
      if (page.nextCursor === afterId)
        throw new Error('Care Task keyset cursor did not advance');
      afterId = page.nextCursor;
    }
    expect(seen).toHaveLength(205);
    expect(new Set(seen).size).toBe(205);
    const state = await reader.readReminderEligibility({
      taskId: seen[0],
      patientId: String(patientId),
    });
    expect(state?.enrollmentStatus).toBe('active');
    await enrollments.updateOne(
      { _id: enrollmentId },
      { $set: { status: 'paused' } },
    );
    expect(
      (
        await reader.readReminderEligibility({
          taskId: seen[0],
          patientId: String(patientId),
        })
      )?.enrollmentStatus,
    ).toBe('paused');
  });
});
