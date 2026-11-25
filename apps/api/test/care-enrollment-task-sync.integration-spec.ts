import { randomBytes } from 'node:crypto';
import mongoose, { Connection, Types } from 'mongoose';
import {
  CareCommandIdempotency,
  CareCommandIdempotencySchema,
} from '../src/modules/chronic-care/domain/entities/care-command-idempotency.entity';
import {
  PatientCareProgram,
  PatientCareProgramSchema,
  PatientCareProgramStatus,
} from '../src/modules/chronic-care/domain/entities/patient-care-program.entity';
import {
  CareTask,
  CareTaskSchema,
  CareTaskStatus,
} from '../src/modules/chronic-care/domain/entities/care-task.entity';
import {
  OutboxEvent,
  OutboxEventSchema,
} from '../src/infrastructure/outbox/entities/outbox-event.entity';
import { OutboxService } from '../src/infrastructure/outbox/outbox.service';
import { CareEnrollmentService } from '../src/modules/chronic-care/application/services/care-enrollment.service';
import { CareTaskSchedulerService } from '../src/modules/chronic-care/application/services/care-task-scheduler.service';
import { OutboxCareEnrollmentTaskSyncAdapter } from '../src/modules/chronic-care/infrastructure/adapters/outbox-care-enrollment-task-sync.adapter';

describe('Care enrollment task synchronization integration', () => {
  let connection: Connection;
  let dbName: string;
  let enrollments: mongoose.Model<any>;
  let tasks: mongoose.Model<any>;
  let idempotencies: mongoose.Model<any>;
  let outboxEvents: mongoose.Model<any>;

  beforeAll(async () => {
    const uri = process.env.TEST_MONGODB_URI ??
      'mongodb://127.0.0.1:27018/admin?replicaSet=rs0&directConnection=true';
    dbName = `healthcare_caresync_${randomBytes(4).toString('hex')}`;
    connection = mongoose.createConnection(uri, {
      dbName,
      serverSelectionTimeoutMS: 5_000,
    });
    await connection.asPromise();
    enrollments = connection.model(PatientCareProgram.name, PatientCareProgramSchema);
    tasks = connection.model(CareTask.name, CareTaskSchema);
    idempotencies = connection.model(CareCommandIdempotency.name, CareCommandIdempotencySchema);
    outboxEvents = connection.model(OutboxEvent.name, OutboxEventSchema);
    await Promise.all([
      enrollments.init(),
      tasks.init(),
      idempotencies.init(),
      outboxEvents.init(),
    ]);
  });

  afterAll(async () => {
    if (/^healthcare_caresync_[a-f0-9]{8}$/.test(dbName))
      await connection.dropDatabase();
    await connection.close();
  });

  beforeEach(async () => {
    await connection.dropDatabase();
    await Promise.all([
      enrollments.init(),
      tasks.init(),
      idempotencies.init(),
      outboxEvents.init(),
    ]);
  });

  function enrollmentService(outbox: OutboxService) {
    return new CareEnrollmentService(
      enrollments as never,
      {} as never,
      {} as never,
      {} as never,
      idempotencies as never,
      connection,
      {} as never,
      {} as never,
      {} as never,
      new OutboxCareEnrollmentTaskSyncAdapter(outbox),
    ) as unknown as {
      command: (
        actor: { id: string },
        operation: string,
        key: string,
        payload: unknown,
        work: (session: mongoose.ClientSession) => Promise<any>,
      ) => Promise<any>;
    };
  }

  async function createEnrollment(session: mongoose.ClientSession, status: string) {
    const [enrollment] = await enrollments.create(
      [
        {
          revision: 4,
          patientId: new Types.ObjectId(),
          doctorId: new Types.ObjectId(),
          careProgramId: new Types.ObjectId(),
          careRuleId: new Types.ObjectId(),
          status,
          timezone: 'Asia/Ho_Chi_Minh',
          consent: { policyVersion: 'synthetic.v1' },
          programConfig: { taskTemplates: [] },
          createdBy: new Types.ObjectId(),
        },
      ],
      { session },
    );
    return enrollment;
  }

  it('commits enrollment transition and task-sync outbox event together; replay is idempotent', async () => {
    const outbox = new OutboxService(outboxEvents as never);
    const service = enrollmentService(outbox);
    const actorId = new Types.ObjectId().toString();
    let workCalls = 0;
    const work = async (session: mongoose.ClientSession) => {
      workCalls += 1;
      return createEnrollment(session, PatientCareProgramStatus.ACTIVE);
    };

    const created = await service.command(actorId ? { id: actorId } : { id: '' }, 'resume', 'sync-test-1', { status: 'active' }, work);
    const replay = await service.command({ id: actorId }, 'resume', 'sync-test-1', { status: 'active' }, work);
    expect(String(replay._id)).toBe(String(created._id));
    expect(workCalls).toBe(1);
    expect(await enrollments.countDocuments()).toBe(1);
    expect(await idempotencies.countDocuments()).toBe(1);
    expect(await outboxEvents.countDocuments({
      eventType: 'care.enrollment.tasks.sync.v1',
      aggregateId: created._id,
      'payload.revision': 4,
    })).toBe(1);
    const event = await outboxEvents.findOne({ aggregateId: created._id }).lean();
    expect(event.payload).toEqual({
      eventVersion: 1,
      enrollmentId: String(created._id),
      revision: 4,
      status: PatientCareProgramStatus.ACTIVE,
    });
  });

  it('rolls back enrollment and outbox together when outbox enqueue fails after insert', async () => {
    const outbox = new OutboxService(outboxEvents as never);
    const enqueue = outbox.enqueue.bind(outbox);
    jest.spyOn(outbox, 'enqueue').mockImplementation(async (...args) => {
      await enqueue(...args);
      throw new Error('synthetic outbox write failure');
    });
    const service = enrollmentService(outbox);

    await expect(
      service.command(
        { id: new Types.ObjectId().toString() },
        'activate',
        'sync-test-rollback',
        { status: 'active' },
        (session) => createEnrollment(session, PatientCareProgramStatus.ACTIVE),
      ),
    ).rejects.toThrow('synthetic outbox write failure');
    expect(await enrollments.countDocuments()).toBe(0);
    expect(await outboxEvents.countDocuments()).toBe(0);
    expect(await idempotencies.countDocuments()).toBe(0);
  });

  it('syncs to current enrollment state instead of an older outbox status', async () => {
    const [enrollment] = await enrollments.create([
      {
        revision: 5,
        patientId: new Types.ObjectId(),
        doctorId: new Types.ObjectId(),
        careProgramId: new Types.ObjectId(),
        careRuleId: new Types.ObjectId(),
        status: PatientCareProgramStatus.CANCELLED,
        timezone: 'Asia/Ho_Chi_Minh',
        consent: { policyVersion: 'synthetic.v1' },
        programConfig: { taskTemplates: [] },
        createdBy: new Types.ObjectId(),
      },
    ]);
    await tasks.create({
      patientCareProgramId: enrollment._id,
      patientId: enrollment.patientId,
      templateKey: 'synthetic-task',
      taskType: 'check_in',
      status: CareTaskStatus.SCHEDULED,
      required: true,
      scheduleVersion: '1',
      scheduledFor: new Date(),
      windowStart: new Date(),
      windowEnd: new Date(Date.now() + 60_000),
      completionRule: {},
      reminderPolicy: {},
      uniqueKey: `${enrollment._id}:synthetic-task:1:2026-11-25`,
    });
    const scheduler = new CareTaskSchedulerService(
      tasks as never,
      enrollments as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await scheduler.syncEnrollmentTasksToCurrentState(
      String(enrollment._id),
      3,
      new Date(),
      true,
    );
    const task = await tasks.findOne({ patientCareProgramId: enrollment._id }).lean();
    expect(task.status).toBe(CareTaskStatus.CANCELLED);
    expect(task.cancellationReason).toBe('enrollment_cancelled');
  });

  it('materializes active enrollment tasks idempotently after activation or resume', async () => {
    const now = new Date();
    const [enrollment] = await enrollments.create([
      {
        revision: 6,
        patientId: new Types.ObjectId(),
        doctorId: new Types.ObjectId(),
        careProgramId: new Types.ObjectId(),
        careRuleId: new Types.ObjectId(),
        status: PatientCareProgramStatus.ACTIVE,
        timezone: 'Asia/Ho_Chi_Minh',
        startedAt: now,
        consent: { policyVersion: 'synthetic.v1' },
        programConfig: {
          programVersion: 1,
          taskTemplates: [
            {
              key: 'synthetic_metric',
              type: 'metric',
              schedule: {
                frequency: 'daily',
                time: '23:59',
                windowMinutes: 60,
              },
              completionRule: { metricType: 'blood_pressure' },
            },
          ],
        },
        createdBy: new Types.ObjectId(),
      },
    ]);
    const queue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const metrics = { findFirstRecordedInWindow: jest.fn().mockResolvedValue(null) };
    const scheduler = new CareTaskSchedulerService(
      tasks as never,
      enrollments as never,
      queue as never,
      metrics as never,
      {} as never,
    );

    await scheduler.syncEnrollmentTasksToCurrentState(
      String(enrollment._id),
      enrollment.revision,
      now,
      true,
    );
    const countAfterFirstSync = await tasks.countDocuments({
      patientCareProgramId: enrollment._id,
    });
    await scheduler.syncEnrollmentTasksToCurrentState(
      String(enrollment._id),
      enrollment.revision,
      now,
      true,
    );

    expect(countAfterFirstSync).toBeGreaterThan(0);
    expect(await tasks.countDocuments({ patientCareProgramId: enrollment._id }))
      .toBe(countAfterFirstSync);
    expect(queue.enqueue).toHaveBeenCalled();

    await enrollments.updateOne(
      { _id: enrollment._id },
      { $set: { status: PatientCareProgramStatus.PAUSED, revision: 7 } },
    );
    await scheduler.syncEnrollmentTasksToCurrentState(String(enrollment._id), 7, now);
    expect(await tasks.countDocuments({ patientCareProgramId: enrollment._id, status: CareTaskStatus.CANCELLED }))
      .toBe(countAfterFirstSync);

    await enrollments.updateOne(
      { _id: enrollment._id },
      { $set: { status: PatientCareProgramStatus.ACTIVE, revision: 8 } },
    );
    await scheduler.syncEnrollmentTasksToCurrentState(String(enrollment._id), 8, now);
    expect(await tasks.countDocuments({ patientCareProgramId: enrollment._id }))
      .toBe(countAfterFirstSync);
    expect(await tasks.countDocuments({
      patientCareProgramId: enrollment._id,
      status: { $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE] },
    })).toBe(countAfterFirstSync);
  });

  it('reconciles every inactive task in stable batches beyond 200 records', async () => {
    const [enrollment] = await enrollments.create([
      {
        revision: 8,
        patientId: new Types.ObjectId(),
        doctorId: new Types.ObjectId(),
        careProgramId: new Types.ObjectId(),
        careRuleId: new Types.ObjectId(),
        status: PatientCareProgramStatus.PAUSED,
        timezone: 'Asia/Ho_Chi_Minh',
        consent: { policyVersion: 'synthetic.v1' },
        programConfig: { taskTemplates: [] },
        createdBy: new Types.ObjectId(),
      },
    ]);
    const now = new Date();
    await tasks.insertMany(
      Array.from({ length: 205 }, (_, index) => ({
        patientCareProgramId: enrollment._id,
        patientId: enrollment.patientId,
        templateKey: `synthetic_task_${index}`,
        taskType: 'check_in',
        status: CareTaskStatus.SCHEDULED,
        required: true,
        scheduleVersion: '1',
        scheduledFor: now,
        windowStart: now,
        windowEnd: new Date(now.getTime() + 60_000),
        completionRule: {},
        reminderPolicy: {},
        uniqueKey: `${enrollment._id}:synthetic:${index}`,
      })),
    );
    const scheduler = new CareTaskSchedulerService(
      tasks as never,
      enrollments as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(scheduler.reconcileInactiveEnrollmentTasks(50)).resolves.toBe(205);
    expect(
      await tasks.countDocuments({
        patientCareProgramId: enrollment._id,
        status: { $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE] },
      }),
    ).toBe(0);
    expect(
      await tasks.countDocuments({
        patientCareProgramId: enrollment._id,
        status: CareTaskStatus.CANCELLED,
      }),
    ).toBe(205);
  });
});
