import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { MongoClient, ObjectId } from 'mongodb';
import { Connection, createConnection } from 'mongoose';
import { migrateDatabase } from '../src/database/migrations/run-migrations';
import { AvailabilitySlotService } from '../src/modules/consultations/application/services/availability/availability-slot.service';
import { BookingPolicyService } from '../src/modules/consultations/application/services/consultations/booking-policy';
import { ScheduledBookingService } from '../src/modules/consultations/application/services/consultations/scheduled-booking.service';
import { ConsultationsService } from '../src/modules/consultations/application/services/consultations/consultations.service';
import {
  AvailabilitySlot,
  AvailabilitySlotLock,
  AvailabilitySlotLockSchema,
  AvailabilitySlotSchema,
  AvailabilitySlotStatus,
} from '../src/modules/consultations/domain/entities/availability/availability-slot.entity';
import {
  Consultation,
  ConsultationSchema,
} from '../src/modules/consultations/domain/entities/consultations/consultation.entity';
import { ConsultationUsageService } from '../src/modules/billing/application/services/consultation-usage.service';
import { FreeSubscriptionGrantService } from '../src/modules/billing/application/services/free-subscription-grant.service';
import {
  ConsultationUsage,
  ConsultationUsageSchema,
} from '../src/modules/billing/domain/entities/consultation-usage.entity';
import {
  Plan,
  PlanSchema,
  PlanStatus,
  snapshotPlan,
} from '../src/modules/billing/domain/entities/plan.entity';
import {
  Subscription,
  SubscriptionSchema,
  SubscriptionSource,
  SubscriptionStatus,
} from '../src/modules/billing/domain/entities/subscription.entity';
import {
  AuditLog,
  AuditLogSchema,
} from '../src/modules/platform-audit/domain/entities/audit-log.entity';
import {
  AccountStatus,
  DoctorVerificationStatus,
  UserRole,
} from '../src/core/domain/user.enums';

jest.setTimeout(45_000);

const baseMongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_booking_test?replicaSet=rs0&directConnection=true';

describe('P0 availability slots and scheduled booking', () => {
  let connection: Connection;
  let availability: AvailabilitySlotService;
  let booking: ScheduledBookingService;
  let consultations: ConsultationsService;
  let usage: ConsultationUsageService;
  let planId: ObjectId;
  const doctorId = new ObjectId();
  const patientIds = new Set<string>();

  beforeAll(async () => {
    const uri = new URL(baseMongoUri);
    uri.pathname = `/healthcare_booking_${randomUUID().replaceAll('-', '')}`;
    const mongo = new MongoClient(uri.toString());
    await mongo.connect();
    await migrateDatabase(mongo.db());
    await mongo.close();

    connection = await createConnection(uri.toString(), {
      autoIndex: false,
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    const slotModel = connection.model(
      AvailabilitySlot.name,
      AvailabilitySlotSchema,
    );
    const lockModel = connection.model(
      AvailabilitySlotLock.name,
      AvailabilitySlotLockSchema,
    );
    const consultationModel = connection.model(
      Consultation.name,
      ConsultationSchema,
    );
    const planModel = connection.model(Plan.name, PlanSchema);
    const subscriptionModel = connection.model(
      Subscription.name,
      SubscriptionSchema,
    );
    const usageModel = connection.model(
      ConsultationUsage.name,
      ConsultationUsageSchema,
    );
    const auditModel = connection.model(AuditLog.name, AuditLogSchema);

    const users = {
      findById: jest.fn(async (id: string) => {
        if (id === doctorId.toHexString()) {
          return {
            _id: doctorId,
            role: UserRole.DOCTOR,
            accountStatus: AccountStatus.ACTIVE,
            doctorProfile: {
              verificationStatus: DoctorVerificationStatus.APPROVED,
            },
          };
        }
        if (patientIds.has(id)) {
          return {
            _id: new ObjectId(id),
            role: UserRole.PATIENT,
            accountStatus: AccountStatus.ACTIVE,
          };
        }
        return {
          _id: new ObjectId(id),
          role: UserRole.PATIENT,
          accountStatus: AccountStatus.BANNED,
        };
      }),
    };
    const policy = new BookingPolicyService(
      new ConfigService({
        SCHEDULED_BOOKING_BUFFER_MINUTES: 15,
        SCHEDULED_BOOKING_MIN_NOTICE_MINUTES: 60,
      }),
    );
    const grants = new FreeSubscriptionGrantService(
      planModel as never,
      subscriptionModel as never,
    );
    usage = new ConsultationUsageService(
      usageModel as never,
      subscriptionModel as never,
      auditModel as never,
      connection,
      grants,
    );
    availability = new AvailabilitySlotService(
      slotModel as never,
      lockModel as never,
      users as never,
      policy,
      connection,
    );
    booking = new ScheduledBookingService(
      consultationModel as never,
      slotModel as never,
      availability,
      users as never,
      policy,
      usage,
      connection,
    );
    consultations = new ConsultationsService(
      consultationModel as never,
      { create: jest.fn().mockResolvedValue(undefined) } as never,
      users as never,
      usage,
      connection,
      booking,
    );

    const createdBy = new ObjectId();
    const plan = await planModel.create({
      code: 'BOOKING_TEST',
      version: 1,
      name: 'Booking Test',
      price: 0,
      currency: 'VND',
      durationDays: 30,
      aiRequestLimit: 10,
      aiTokenLimit: 10_000,
      aiQuotaPeriod: 'day',
      consultationLimitPerCycle: 5,
      activeCareProgramLimit: 1,
      benefits: {},
      refundPolicy: {},
      status: PlanStatus.PUBLISHED,
      createdBy,
      publishedBy: createdBy,
      publishedAt: new Date(),
    });
    planId = plan._id;
  });

  afterAll(async () => {
    if (!connection) return;
    await connection.dropDatabase();
    await connection.close();
  });

  beforeEach(async () => {
    await Promise.all([
      connection.model(AvailabilitySlot.name).deleteMany({}),
      connection.model(AvailabilitySlotLock.name).deleteMany({}),
      connection.model(Consultation.name).deleteMany({}),
      connection.model(ConsultationUsage.name).deleteMany({}),
      connection.model(Subscription.name).deleteMany({}),
      connection.model(AuditLog.name).deleteMany({ domain: 'billing' }),
    ]);
    patientIds.clear();
  });

  it('creates valid UTC slots and rejects invalid, past, min-notice and buffered overlap ranges', async () => {
    const start = future(180);
    const end = new Date(start.getTime() + 30 * 60_000);
    const created = await availability.create(doctorId.toHexString(), {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      timezone: 'Asia/Ho_Chi_Minh',
    });
    expect(created.data).toMatchObject({
      doctorId,
      status: AvailabilitySlotStatus.AVAILABLE,
      startAt: start,
      endAt: end,
    });

    await expect(
      availability.create(doctorId.toHexString(), {
        startAt: end.toISOString(),
        endAt: start.toISOString(),
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_SLOT_RANGE' }),
    });
    await expect(
      availability.create(doctorId.toHexString(), {
        startAt: new Date(Date.now() - 60_000).toISOString(),
        endAt: future(5).toISOString(),
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SLOT_IN_PAST' }),
    });
    await expect(
      availability.create(doctorId.toHexString(), {
        startAt: future(30).toISOString(),
        endAt: future(45).toISOString(),
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MIN_NOTICE_NOT_MET' }),
    });
    await expect(
      availability.create(doctorId.toHexString(), {
        startAt: new Date(end.getTime() + 10 * 60_000).toISOString(),
        endAt: new Date(end.getTime() + 40 * 60_000).toISOString(),
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SLOT_OVERLAP' }),
    });
  });

  it('returns only available, future and notice-compliant slots to patients', async () => {
    const first = await createSlot(180);
    const second = await createSlot(240);
    await availability.block(
      doctorId.toHexString(),
      second.data.id,
      'Unavailable',
    );
    const result = await availability.listAvailable(doctorId.toHexString(), {
      from: new Date().toISOString(),
      to: future(24 * 60).toISOString(),
      page: 1,
      limit: 20,
      sortOrder: 1,
    });
    expect(result.data.map((item) => item.id)).toEqual([first.data.id]);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      pages: 1,
    });

    const doctorResult = await availability.listMine(doctorId.toHexString(), {
      from: new Date().toISOString(),
      to: future(24 * 60).toISOString(),
      status: AvailabilitySlotStatus.BLOCKED,
      page: 1,
      limit: 1,
      sortOrder: 1,
    });
    expect(doctorResult.data.map((item) => item.id)).toEqual([second.data.id]);
    expect(doctorResult.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 1,
      pages: 1,
    });
    await expect(
      availability.block(
        new ObjectId().toHexString(),
        first.data.id,
        'Unauthorized',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FORBIDDEN' }),
    });
  });

  it('books once with active-cycle quota and replays the same idempotent request', async () => {
    const patientId = await activePatient(2);
    const slot = await createSlot(180);
    const dto = {
      availabilitySlotId: slot.data.id,
      patientNotes: 'Follow-up',
    };
    const first = await booking.book(patientId, 'booking-retry', dto);
    const replay = await booking.book(patientId, 'booking-retry', dto);
    expect(replay.data.id).toBe(first.data.id);
    expect(first.data).toMatchObject({
      patientId: new ObjectId(patientId),
      doctorId,
      requestStatus: 'accepted',
      sessionStatus: 'not_started',
      quotaPolicy: 'consultation_limit',
    });
    expect(
      await connection.model(ConsultationUsage.name).countDocuments({}),
    ).toBe(1);
  });

  it('rejects exhausted quota, inactive actors and idempotency-key ownership conflicts', async () => {
    const exhausted = await activePatient(0);
    const slot = await createSlot(180);
    await expect(
      booking.book(exhausted, 'quota-empty', {
        availabilitySlotId: slot.data.id,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'QUOTA_EXCEEDED' }),
    });
    expect(
      await connection
        .model(AvailabilitySlot.name)
        .findById(slot.data.id)
        .lean(),
    ).toMatchObject({ status: 'available' });

    const banned = new ObjectId().toHexString();
    await expect(
      booking.book(banned, 'banned', {
        availabilitySlotId: slot.data.id,
      }),
    ).rejects.toBeInstanceOf(HttpException);

    const inactive = await activePatient(1);
    jest.spyOn(usage, 'prepare').mockRejectedValueOnce(new Error('inactive'));
    await expect(
      booking.book(inactive, 'inactive-subscription', {
        availabilitySlotId: slot.data.id,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SUBSCRIPTION_INACTIVE' }),
    });

    const patientId = await activePatient(2);
    await booking.book(patientId, 'same-key', {
      availabilitySlotId: slot.data.id,
    });
    await expect(
      booking.book(patientId, 'same-key', {
        availabilitySlotId: new ObjectId().toHexString(),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'IDEMPOTENCY_CONFLICT' }),
    });
  });

  it('allows exactly one of two concurrent patients to book the same slot', async () => {
    const [firstPatient, secondPatient] = await Promise.all([
      activePatient(1),
      activePatient(1),
    ]);
    const slot = await createSlot(180);
    const results = await Promise.allSettled([
      booking.book(firstPatient, 'race-a', {
        availabilitySlotId: slot.data.id,
      }),
      booking.book(secondPatient, 'race-b', {
        availabilitySlotId: slot.data.id,
      }),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(
      1,
    );
    expect(await connection.model(Consultation.name).countDocuments({})).toBe(
      1,
    );
    expect(
      await connection.model(ConsultationUsage.name).countDocuments({}),
    ).toBe(1);
  });

  it('reopens the slot and releases quota on an in-policy patient cancellation', async () => {
    const patientId = await activePatient(1);
    const slot = await createSlot(180);
    const booked = await booking.book(patientId, 'cancel-ok', {
      availabilitySlotId: slot.data.id,
    });
    await consultations.cancel(patientId, booked.data.id, {
      reason: 'Schedule changed',
    });
    expect(
      await connection
        .model(AvailabilitySlot.name)
        .findById(slot.data.id)
        .lean(),
    ).toMatchObject({ status: 'available' });
    expect(
      await connection
        .model(ConsultationUsage.name)
        .findOne({ consultationId: new ObjectId(booked.data.id) })
        .lean(),
    ).toMatchObject({ status: 'released' });
  });

  it('rejects patient cancellation and reschedule after the snapshotted cutoff', async () => {
    const patientId = await activePatient(2);
    const oldSlot = await createSlot(180);
    const nextSlot = await createSlot(300);
    const booked = await booking.book(patientId, 'cutoff-book', {
      availabilitySlotId: oldSlot.data.id,
    });
    await connection
      .model(Consultation.name)
      .updateOne(
        { _id: booked.data.id },
        { $set: { scheduledStartAt: future(30) } },
      );
    await expect(
      consultations.cancel(patientId, booked.data.id, {
        reason: 'Too late',
      }),
    ).rejects.toThrow('Cancellation deadline has passed');
    await expect(
      booking.reschedule(
        patientId,
        booked.data.id,
        'cutoff-reschedule',
        nextSlot.data.id,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RESCHEDULE_CUTOFF_PASSED' }),
    });
  });

  async function createSlot(minutesFromNow: number) {
    const startAt = future(minutesFromNow);
    return availability.create(doctorId.toHexString(), {
      startAt: startAt.toISOString(),
      endAt: new Date(startAt.getTime() + 30 * 60_000).toISOString(),
      timezone: 'Asia/Ho_Chi_Minh',
    });
  }

  async function activePatient(limit: number) {
    const patientId = new ObjectId();
    patientIds.add(patientId.toHexString());
    const now = new Date();
    await connection.model(Subscription.name).create({
      userId: patientId,
      planId,
      status: SubscriptionStatus.ACTIVE,
      source: SubscriptionSource.ADMIN_DEMO,
      planSnapshot: {
        ...snapshotPlan({
          code: 'TEST',
          version: 1,
          name: 'Test',
          price: 0,
          currency: 'VND',
          durationDays: 30,
          aiRequestLimit: 1,
          aiTokenLimit: 1,
          aiQuotaPeriod: 'day',
          consultationLimitPerCycle: limit,
          activeCareProgramLimit: 1,
          benefits: {},
          refundPolicy: {},
          status: PlanStatus.PUBLISHED,
          createdBy: new ObjectId(),
        } as Plan),
        consultationLimitPerCycle: limit,
      },
      cycleNumber: 1,
      currentPeriodStart: new Date(now.getTime() - 60_000),
      currentPeriodEnd: new Date(now.getTime() + 86_400_000),
      startedAt: now,
      expiresAt: new Date(now.getTime() + 86_400_000),
    });
    return patientId.toHexString();
  }
});

function future(minutes: number) {
  return new Date(Date.now() + minutes * 60_000);
}
