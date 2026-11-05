import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { MongoClient, ObjectId } from 'mongodb';
import { Connection, createConnection, Model } from 'mongoose';
import { migrateDatabase } from '../src/database/migrations/run-migrations';
import { BookingPolicyService } from '../src/modules/consultations/application/services/consultations/booking-policy';
import { ConsultationQueueService } from '../src/modules/consultations/application/services/consultations/consultation-queue.service';
import { ConsultationsService } from '../src/modules/consultations/application/services/consultations/consultations.service';
import {
  Consultation,
  ConsultationMode,
  ConsultationRequestStatus,
  ConsultationSchema,
  ConsultationSessionStatus,
} from '../src/modules/consultations/domain/entities/consultations/consultation.entity';
import {
  User,
  UserSchema,
} from '../src/modules/users/domain/entities/users/user.schema';
import {
  AccountStatus,
  DoctorVerificationStatus,
  UserRole,
} from '../src/core/domain/user.enums';

jest.setTimeout(45_000);

const baseMongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_queue_test?replicaSet=rs0&directConnection=true';

describe('P0 patient check-in and doctor queue', () => {
  let connection: Connection;
  let queue: ConsultationQueueService;
  let consultations: ConsultationsService;
  let consultationModel: Model<Consultation>;
  let userModel: Model<User>;
  let doctorId: ObjectId;
  let otherDoctorId: ObjectId;
  let patientId: ObjectId;
  let otherPatientId: ObjectId;

  beforeAll(async () => {
    const uri = new URL(baseMongoUri);
    uri.pathname = `/healthcare_queue_${randomUUID().replaceAll('-', '')}`;
    const mongo = new MongoClient(uri.toString());
    await mongo.connect();
    await migrateDatabase(mongo.db());
    await mongo.close();

    connection = await createConnection(uri.toString(), {
      autoIndex: false,
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    consultationModel = connection.model(Consultation.name, ConsultationSchema);
    userModel = connection.model(User.name, UserSchema);

    const users = {
      findById: jest.fn(async (id: string) => {
        const user = await userModel.findById(id).lean().exec();
        if (!user) throw new Error('User not found');
        return user;
      }),
    };
    const policy = new BookingPolicyService(
      new ConfigService({ CONSULTATION_CHECK_IN_EARLY_MINUTES: 15 }),
    );
    queue = new ConsultationQueueService(
      consultationModel as never,
      users as never,
      policy,
      connection,
    );
    consultations = new ConsultationsService(
      consultationModel as never,
      { create: jest.fn().mockResolvedValue(undefined) } as never,
      users as never,
      {
        count: jest.fn().mockResolvedValue('counted'),
        release: jest.fn().mockResolvedValue('released'),
      } as never,
      connection,
    );
  });

  afterAll(async () => {
    if (!connection) return;
    await connection.dropDatabase();
    await connection.close();
  });

  beforeEach(async () => {
    await Promise.all([
      consultationModel.deleteMany({}),
      userModel.deleteMany({}),
    ]);
    doctorId = await createUser(UserRole.DOCTOR, 'Doctor One');
    otherDoctorId = await createUser(UserRole.DOCTOR, 'Doctor Two');
    patientId = await createUser(UserRole.PATIENT, 'Patient One');
    otherPatientId = await createUser(UserRole.PATIENT, 'Patient Two');
  });

  it('checks in the owner inside the window and replays without duplicate side effects', async () => {
    const consultation = await createScheduled({ patientId, doctorId });

    const first = await queue.checkIn(
      patientId.toHexString(),
      String(consultation._id),
      'check-in-retry',
    );
    const replay = await queue.checkIn(
      patientId.toHexString(),
      String(consultation._id),
      'check-in-retry',
    );

    expect(replay.data.id).toBe(first.data.id);
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.queue).toMatchObject({ status: 'waiting', position: 1 });
    const stored = await consultationModel.findById(consultation._id).lean();
    expect(stored).toMatchObject({
      sessionStatus: ConsultationSessionStatus.WAITING,
      queuePriorityAt: consultation.scheduledStartAt,
    });
    expect(stored?.queueJoinedAt).toBeInstanceOf(Date);
  });

  it('rejects early, wrong-owner, on-demand and terminal check-ins', async () => {
    const early = await createScheduled({
      patientId,
      doctorId,
      scheduledStartAt: future(30),
    });
    await expect(
      queue.checkIn(patientId.toHexString(), String(early._id), 'too-early'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CHECK_IN_TOO_EARLY' }),
    });
    await expect(
      queue.checkIn(otherPatientId.toHexString(), String(early._id), 'wrong'),
    ).rejects.toMatchObject({ status: 403 });

    const onDemand = await createScheduled({
      patientId,
      doctorId,
      mode: ConsultationMode.ON_DEMAND,
    });
    await expect(
      queue.checkIn(patientId.toHexString(), String(onDemand._id), 'on-demand'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CHECK_IN_INVALID_STATE' }),
    });

    const terminal = await createScheduled({
      patientId,
      doctorId,
      requestStatus: ConsultationRequestStatus.CANCELLED,
    });
    await expect(
      queue.checkIn(patientId.toHexString(), String(terminal._id), 'terminal'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CHECK_IN_INVALID_STATE' }),
    });
  });

  it('fails closed when neither the booking snapshot nor configuration defines check-in early minutes', async () => {
    const failClosed = new ConsultationQueueService(
      consultationModel as never,
      {
        findById: async (id: string) => userModel.findById(id).lean(),
      } as never,
      new BookingPolicyService(new ConfigService({})),
      connection,
    );
    const consultation = await createScheduled({
      patientId,
      doctorId,
      bookingSettingsSnapshot: { noShowAfterMinutes: 10 },
    });
    await expect(
      failClosed.checkIn(
        patientId.toHexString(),
        String(consultation._id),
        'missing-policy',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CHECK_IN_POLICY_NOT_CONFIGURED',
      }),
    });
  });

  it('returns only the patient-owned queue projection and a deterministic position', async () => {
    const first = await createWaiting({
      patientId: otherPatientId,
      doctorId,
      scheduledStartAt: future(-2),
      queueJoinedAt: new Date(Date.now() - 2_000),
    });
    const own = await createWaiting({
      patientId,
      doctorId,
      scheduledStartAt: future(-1),
      queueJoinedAt: new Date(Date.now() - 1_000),
    });

    const result = await queue.getPatientQueue(
      patientId.toHexString(),
      String(own._id),
    );
    expect(result).toEqual(
      expect.objectContaining({
        consultationId: String(own._id),
        status: 'waiting',
        position: 2,
        estimatedWaitMinutes: null,
        etaReason: 'ETA_POLICY_NOT_CONFIGURED',
      }),
    );
    expect(JSON.stringify(result)).not.toContain(otherPatientId.toHexString());
    await expect(
      queue.getPatientQueue(patientId.toHexString(), String(first._id)),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('lists only the doctor queue with stable ordering and pagination', async () => {
    const samePriority = future(-1);
    const first = await createWaiting({
      patientId,
      doctorId,
      scheduledStartAt: samePriority,
      queueJoinedAt: new Date(Date.now() - 2_000),
    });
    const second = await createWaiting({
      patientId: otherPatientId,
      doctorId,
      scheduledStartAt: samePriority,
      queueJoinedAt: new Date(Date.now() - 1_000),
    });
    await createWaiting({
      patientId: otherPatientId,
      doctorId: otherDoctorId,
      scheduledStartAt: future(-5),
    });

    const pageOne = await queue.listDoctorQueue(doctorId.toHexString(), {
      page: 1,
      limit: 1,
    });
    const pageTwo = await queue.listDoctorQueue(doctorId.toHexString(), {
      page: 2,
      limit: 1,
    });
    expect(pageOne.data[0].consultationId).toBe(String(first._id));
    expect(pageTwo.data[0].consultationId).toBe(String(second._id));
    expect(pageOne.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      pages: 2,
    });
  });

  it('atomically calls only the queue head and replays the same key', async () => {
    const head = await createWaiting({
      patientId,
      doctorId,
      scheduledStartAt: future(-2),
    });
    await createWaiting({
      patientId: otherPatientId,
      doctorId,
      scheduledStartAt: future(-1),
    });

    const first = await queue.callNext(doctorId.toHexString(), 'call-retry');
    const replay = await queue.callNext(doctorId.toHexString(), 'call-retry');
    expect(first.data.id).toBe(String(head._id));
    expect(replay.data.id).toBe(first.data.id);
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(first.data.sessionStatus).toBe(ConsultationSessionStatus.WAITING);
    expect(first.data.calledAt).toBeInstanceOf(Date);
    expect(
      await consultationModel.countDocuments({
        doctorId,
        calledAt: { $type: 'date' },
      }),
    ).toBe(1);
  });

  it('allows only one winner for concurrent call-next requests', async () => {
    await createWaiting({ patientId, doctorId, scheduledStartAt: future(-2) });
    await createWaiting({
      patientId: otherPatientId,
      doctorId,
      scheduledStartAt: future(-1),
    });

    const results = await Promise.allSettled([
      queue.callNext(doctorId.toHexString(), 'race-a'),
      queue.callNext(doctorId.toHexString(), 'race-b'),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(
      1,
    );
    expect(
      await consultationModel.countDocuments({
        doctorId,
        calledAt: { $type: 'date' },
      }),
    ).toBe(1);
  });

  it('does not call next while the doctor has an active consultation', async () => {
    await createWaiting({ patientId, doctorId });
    await createScheduled({
      patientId: otherPatientId,
      doctorId,
      sessionStatus: ConsultationSessionStatus.IN_CONSULTATION,
    });
    await expect(
      queue.callNext(doctorId.toHexString(), 'active-session'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'DOCTOR_ACTIVE_SESSION_CONFLICT',
      }),
    });
  });

  it('resolves a check-in/cancel race to a terminal non-queued state', async () => {
    const consultation = await createScheduled({ patientId, doctorId });
    await Promise.allSettled([
      queue.checkIn(
        patientId.toHexString(),
        String(consultation._id),
        'check-in-cancel-race',
      ),
      consultations.cancel(doctorId.toHexString(), String(consultation._id), {
        reason: 'Doctor unavailable',
      }),
    ]);

    const stored = await consultationModel.findById(consultation._id).lean();
    expect(stored).toMatchObject({
      requestStatus: ConsultationRequestStatus.CANCELLED,
      sessionStatus: ConsultationSessionStatus.NOT_STARTED,
    });
  });

  it('resolves a call-next/no-show race without leaving a called queue item', async () => {
    const consultation = await createWaiting({
      patientId,
      doctorId,
      scheduledStartAt: future(-11),
    });
    await Promise.allSettled([
      queue.callNext(doctorId.toHexString(), 'call-no-show-race'),
      consultations.markNoShow(
        doctorId.toHexString(),
        String(consultation._id),
        'Patient absent',
      ),
    ]);

    const stored = await consultationModel.findById(consultation._id).lean();
    expect(stored).toMatchObject({
      requestStatus: ConsultationRequestStatus.ACCEPTED,
      sessionStatus: ConsultationSessionStatus.NO_SHOW,
    });
    expect(
      await consultationModel.countDocuments({
        doctorId,
        sessionStatus: ConsultationSessionStatus.WAITING,
        calledAt: { $type: 'date' },
      }),
    ).toBe(0);
  });

  async function createUser(role: UserRole, fullName: string) {
    const user = await userModel.create({
      fullName,
      role,
      accountStatus: AccountStatus.ACTIVE,
      ...(role === UserRole.DOCTOR
        ? {
            doctorProfile: {
              verificationStatus: DoctorVerificationStatus.APPROVED,
            },
          }
        : {}),
    });
    return user._id as ObjectId;
  }

  async function createScheduled(
    overrides: Record<string, unknown> & {
      patientId: ObjectId;
      doctorId: ObjectId;
    },
  ) {
    const scheduledStartAt =
      (overrides.scheduledStartAt as Date | undefined) ?? future(5);
    return consultationModel.create({
      mode: ConsultationMode.SCHEDULED,
      requestStatus: ConsultationRequestStatus.ACCEPTED,
      sessionStatus: ConsultationSessionStatus.NOT_STARTED,
      requestedAt: new Date(),
      respondedAt: new Date(),
      scheduledStartAt,
      scheduledEndAt: new Date(scheduledStartAt.getTime() + 30 * 60_000),
      expectedDurationMinutes: 30,
      timezone: 'Asia/Ho_Chi_Minh',
      bookingSettingsSnapshot: {
        checkInEarlyMinutes: 15,
        noShowAfterMinutes: 10,
      },
      ...overrides,
    });
  }

  async function createWaiting(
    overrides: Record<string, unknown> & {
      patientId: ObjectId;
      doctorId: ObjectId;
    },
  ) {
    const scheduledStartAt =
      (overrides.scheduledStartAt as Date | undefined) ?? future(-1);
    const queueJoinedAt =
      (overrides.queueJoinedAt as Date | undefined) ?? new Date();
    return createScheduled({
      ...overrides,
      scheduledStartAt,
      sessionStatus: ConsultationSessionStatus.WAITING,
      queueJoinedAt,
      queuePriorityAt: scheduledStartAt,
    });
  }
});

function future(minutes: number) {
  return new Date(Date.now() + minutes * 60_000);
}
