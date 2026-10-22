import { MongoClient, ObjectId } from 'mongodb';
import { exemptLegacyConsultations } from '../src/scripts/exempt-legacy-consultations';
import { Connection, createConnection } from 'mongoose';
import { applyCc012BillingAccess } from '../src/database/migrations/202610151000-cc012-billing-access';
import { applyCc013ConsultationUsageLedger } from '../src/database/migrations/202610161100-cc013-consultation-usage-ledger';
import { applyCc013BookingPolicy } from '../src/database/migrations/202610181000-cc013-booking-policy-snapshot';
import { applyCc013LegacyExemption } from '../src/database/migrations/202610181100-cc013-legacy-quota-exemption';
import { applyCc013aUrgentAlertBenefit } from '../src/database/migrations/202610201000-cc013a-urgent-alert-consultation-benefit';
import { applyCc013bStaleConsultationRecovery } from '../src/database/migrations/202610201100-cc013b-stale-consultation-recovery';
import { applyCc012bAiQuota } from '../src/database/migrations/202610211000-cc012b-ai-quota';
import { applyCc012bAiQuotaSettlement } from '../src/database/migrations/202610221000-cc012b-ai-quota-settlement';
import { applyCc012bUsageReconciliationName } from '../src/database/migrations/202610221100-cc012b-usage-reconciliation-name';
import { ConsultationUsageService } from '../src/modules/billing/application/services/consultation-usage.service';
import { FreeSubscriptionGrantService } from '../src/modules/billing/application/services/free-subscription-grant.service';
import { ConsultationsService } from '../src/modules/consultations/application/services/consultations/consultations.service';
import {
  Consultation,
  ConsultationSchema,
  ConsultationMode,
  ConsultationQuotaPolicy,
  ConsultationRequestStatus,
  ConsultationSessionStatus,
} from '../src/modules/consultations/domain/entities/consultations/consultation.entity';
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
import { CareAlertConsultationService } from '../src/modules/consultations/application/services/consultations/care-alert-consultation.service';
import { ConsultationStaleRecoveryService } from '../src/modules/consultations/application/services/consultations/consultation-stale-recovery.service';
import {
  OutboxEvent,
  OutboxEventSchema,
} from '../src/infrastructure/outbox/entities/outbox-event.entity';
import { OutboxService } from '../src/infrastructure/outbox/outbox.service';
import { AiQuotaService } from '../src/modules/billing/application/services/ai-quota.service';
import { AiQuotaReservation, AiQuotaReservationSchema, AiUsageDaily, AiUsageDailySchema } from '../src/modules/billing/domain/entities/ai-usage.entity';

jest.setTimeout(30_000);

const baseMongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_cc013_test?replicaSet=rs0&directConnection=true';

describe('CC-013 consultation usage ledger', () => {
  let connection: Connection;
  let usage: ConsultationUsageService;
  let planId: ObjectId;

  beforeAll(async () => {
    const uri = new URL(baseMongoUri);
    uri.pathname = `/healthcare_cc013_${new ObjectId().toHexString()}`;
    connection = await createConnection(uri.toString(), {
      autoIndex: false,
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    await applyCc012BillingAccess(connection.db!);
    await applyCc013ConsultationUsageLedger(connection.db!);
    await connection.db!.createCollection('consultations');
    await applyCc013aUrgentAlertBenefit(connection.db!);
    await applyCc013bStaleConsultationRecovery(connection.db!);
    await applyCc012bAiQuota(connection.db!);
    await applyCc012bAiQuotaSettlement(connection.db!);
    await applyCc012bUsageReconciliationName(connection.db!);
    const plans = connection.model(Plan.name, PlanSchema);
    const subscriptions = connection.model(
      Subscription.name,
      SubscriptionSchema,
    );
    const usages = connection.model(
      ConsultationUsage.name,
      ConsultationUsageSchema,
    );
    const audits = connection.model(AuditLog.name, AuditLogSchema);
    const events = connection.model(OutboxEvent.name, OutboxEventSchema);
    connection.model(AiUsageDaily.name, AiUsageDailySchema);
    connection.model(AiQuotaReservation.name, AiQuotaReservationSchema);
    connection.model(Consultation.name, ConsultationSchema);
    await events.init();
    planId = new ObjectId();
    const now = new Date();
    await connection.db!.collection('plans').insertOne({
      _id: planId,
      ...planFixture(),
      createdAt: now,
      updatedAt: now,
    });
    usage = new ConsultationUsageService(
      usages as never,
      subscriptions as never,
      audits as never,
      connection,
      new FreeSubscriptionGrantService(plans as never, subscriptions as never),
    );
  });

  afterAll(async () => {
    if (!connection) return;
    await connection.dropDatabase();
    await connection.close();
  });

  it('reserves once for retry, counts once when started, and releases only active reservations', async () => {
    const patientId = await activeSubscription(1);
    const consultationId = new ObjectId().toHexString();

    const retries = await Promise.all([
      usage.reserve({
        consultationId,
        patientId,
      }),
      usage.reserve({
        consultationId,
        patientId,
      }),
    ]);
    expect(retries.map((item) => item.created).sort()).toEqual([false, true]);
    await expect(usage.count({ consultationId })).resolves.toBe('counted');
    await expect(usage.count({ consultationId })).resolves.toBe('counted');
    await expect(
      usage.release({ consultationId, reason: 'cancelled' }),
    ).resolves.toBe('counted');

    const subscription = await connection
      .model(Subscription.name)
      .findOne({ userId: new ObjectId(patientId) })
      .lean();
    expect(subscription).toMatchObject({
      consultationUsageReserved: 0,
      consultationUsageCounted: 1,
    });
    expect(
      await connection
        .db!.collection('auditlogs')
        .countDocuments({ domain: 'billing', entityType: 'consultationUsage' }),
    ).toBe(2);
  });

  it('does not exceed the snapshotted limit under concurrent reservations', async () => {
    const patientId = await activeSubscription(1);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        usage.reserve({
          consultationId: new ObjectId().toHexString(),
          patientId,
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(7);
  });

  it('releases cancelled reservations and reconciles damaged counters without expiring bookings', async () => {
    const patientId = await activeSubscription(1);
    const first = new ObjectId().toHexString();
    await usage.reserve({
      consultationId: first,
      patientId,
    });
    await expect(
      usage.release({ consultationId: first, reason: 'cancelled' }),
    ).resolves.toBe('released');
    await expect(
      usage.reserve({
        consultationId: new ObjectId().toHexString(),
        patientId,
      }),
    ).resolves.toMatchObject({ created: true });

    await connection
      .model(Subscription.name)
      .updateOne(
        { userId: new ObjectId(patientId) },
        { $set: { consultationUsageReserved: 9 } },
      );
    expect(
      (await usage.reconcileCounters(100)).repaired,
    ).toBeGreaterThanOrEqual(1);
    const subscription = await connection
      .model(Subscription.name)
      .findOne({ userId: new ObjectId(patientId) })
      .lean();
    expect(subscription).toMatchObject({
      consultationUsageReserved: 1,
      consultationUsageCounted: 0,
    });
  });

  it('commits booking and quota together and rolls back a failed start', async () => {
    const patientId = await activeSubscription(1);
    const doctorId = new ObjectId().toHexString();
    const model = connection.model(Consultation.name);
    const consultation = await model.create({
      patientId: new ObjectId(patientId),
      doctorId: new ObjectId(doctorId),
      mode: ConsultationMode.SCHEDULED,
      requestStatus: ConsultationRequestStatus.PENDING,
      sessionStatus: ConsultationSessionStatus.NOT_STARTED,
      requestedAt: new Date(),
      scheduledStartAt: new Date(Date.now() + 3_600_000),
      scheduledEndAt: new Date(Date.now() + 5_400_000),
    });
    const notifications = { create: jest.fn().mockResolvedValue(undefined) };
    const service = new ConsultationsService(
      model as never,
      notifications as never,
      {} as never,
      usage,
      connection,
    );
    await service.accept(doctorId, String(consultation._id));
    const accepted = await model.findById(consultation._id).lean();
    expect(accepted).toMatchObject({
      requestStatus: 'accepted',
      sessionStatus: 'waiting',
      bookingSettingsSnapshot: {
        cancellationDeadlineMinutes: 60,
        noShowAfterMinutes: 10,
      },
    });
    const failingUsage = {
      listReserved: usage.listReserved.bind(usage),
      prepare: usage.prepare.bind(usage),
      reserve: usage.reserve.bind(usage),
      release: usage.release.bind(usage),
      count: async (input: Parameters<typeof usage.count>[0]) => {
        await usage.count(input);
        throw new Error('simulated failure');
      },
    };
    const failingService = new ConsultationsService(
      model as never,
      notifications as never,
      {} as never,
      failingUsage,
      connection,
    );
    await expect(
      failingService.start(doctorId, String(consultation._id)),
    ).rejects.toThrow('simulated failure');
    expect(await model.findById(consultation._id).lean()).toMatchObject({
      sessionStatus: 'waiting',
    });
    expect(
      await connection
        .db!.collection('consultationusages')
        .findOne({ consultationId: consultation._id }),
    ).toMatchObject({ status: 'reserved' });
    await service.start(doctorId, String(consultation._id));
    expect(await model.findById(consultation._id).lean()).toMatchObject({
      sessionStatus: 'in_consultation',
    });
    expect(
      await connection
        .db!.collection('consultationusages')
        .findOne({ consultationId: consultation._id }),
    ).toMatchObject({ status: 'counted' });
  });

  it('does not alter a new cycle counter when an earlier reservation is counted', async () => {
    const patientId = await activeSubscription(1);
    const consultationId = new ObjectId().toHexString();
    await usage.reserve({ consultationId, patientId });
    await connection.model(Subscription.name).updateOne(
      { userId: new ObjectId(patientId) },
      {
        $set: {
          currentPeriodStart: new Date(),
          consultationUsageReserved: 0,
          consultationUsageCounted: 0,
        },
      },
    );
    await expect(usage.count({ consultationId })).resolves.toBe('counted');
    expect(
      await connection
        .model(Subscription.name)
        .findOne({ userId: new ObjectId(patientId) })
        .lean(),
    ).toMatchObject({
      consultationUsageReserved: 0,
      consultationUsageCounted: 0,
    });
  });

  it('creates an urgent alert consultation without quota, while attention still reserves', async () => {
    const model = connection.model(Consultation.name);
    const service = new CareAlertConsultationService(
      model as never,
      connection.model(AuditLog.name) as never,
      connection,
      { enqueue: jest.fn().mockResolvedValue({}) } as never,
      usage,
    );
    const patientId = new ObjectId().toHexString();
    const doctorId = new ObjectId().toHexString();
    const included = await service.createFromCareAlert({
      careAlertId: new ObjectId().toHexString(),
      patientCareProgramId: new ObjectId().toHexString(),
      patientId,
      doctorId,
      quotaPolicy: ConsultationQuotaPolicy.CARE_PROGRAM_INCLUDED,
      expectedDurationMinutes: 30,
    });
    expect(
      await connection.db!.collection('consultationusages').countDocuments({
        consultationId: new ObjectId(included.id),
      }),
    ).toBe(0);
    expect(await model.findById(included.id).lean()).toMatchObject({
      quotaPolicy: 'care_program_included',
    });

    const quotaPatientId = await activeSubscription(1);
    await usage.reserve({
      consultationId: new ObjectId().toHexString(),
      patientId: quotaPatientId,
    });
    await expect(
      service.createFromCareAlert({
        careAlertId: new ObjectId().toHexString(),
        patientCareProgramId: new ObjectId().toHexString(),
        patientId: quotaPatientId,
        doctorId,
        quotaPolicy: ConsultationQuotaPolicy.CONSULTATION_LIMIT,
        expectedDurationMinutes: 30,
      }),
    ).rejects.toThrow();
  });

  it('never creates a ledger when an included consultation starts, cancels or is reconciled', async () => {
    const patientId = new ObjectId();
    const doctorId = new ObjectId();
    const model = connection.model(Consultation.name);
    const consultation = await model.create({
      patientId,
      doctorId,
      mode: ConsultationMode.ON_DEMAND,
      requestStatus: ConsultationRequestStatus.ACCEPTED,
      sessionStatus: ConsultationSessionStatus.WAITING,
      quotaPolicy: ConsultationQuotaPolicy.CARE_PROGRAM_INCLUDED,
      requestedAt: new Date(),
    });
    const service = new ConsultationsService(
      model as never,
      { create: jest.fn() } as never,
      {} as never,
      usage,
      connection,
    );
    await service.start(String(doctorId), String(consultation._id));
    await service.cancel(String(doctorId), String(consultation._id), {});
    await expect(
      service.reconcileReservedUsage(String(consultation._id)),
    ).resolves.toBe('unchanged');
    expect(
      await connection.db!.collection('consultationusages').countDocuments({
        consultationId: consultation._id,
      }),
    ).toBe(0);
  });

  it('reconciles an orphaned transition but keeps an accepted waiting reservation', async () => {
    const patientId = await activeSubscription(2);
    const doctorId = new ObjectId();
    const model = connection.model(Consultation.name);
    const service = new ConsultationsService(
      model as never,
      { create: jest.fn() } as never,
      {} as never,
      usage,
      connection,
    );
    const waiting = await model.create({
      patientId: new ObjectId(patientId),
      doctorId,
      mode: ConsultationMode.ON_DEMAND,
      requestStatus: ConsultationRequestStatus.ACCEPTED,
      sessionStatus: ConsultationSessionStatus.WAITING,
      requestedAt: new Date(),
    });
    await usage.reserve({ consultationId: String(waiting._id), patientId });
    expect(await service.reconcileReservedUsage(String(waiting._id))).toBe(
      'unchanged',
    );
    await model.updateOne(
      { _id: waiting._id },
      { $set: { sessionStatus: ConsultationSessionStatus.IN_CONSULTATION } },
    );
    expect(await service.reconcileReservedUsage(String(waiting._id))).toBe(
      'counted',
    );
    expect(
      await connection
        .db!.collection('consultationusages')
        .findOne({ consultationId: waiting._id }),
    ).toMatchObject({ status: 'counted' });
  });

  it('backfills only missing snapshots for confirmed scheduled bookings', async () => {
    const patientId = new ObjectId();
    const doctorId = new ObjectId();
    const model = connection.model(Consultation.name);
    const make = (snapshot?: Record<string, number>) =>
      model.create({
        patientId,
        doctorId,
        mode: ConsultationMode.SCHEDULED,
        requestStatus: ConsultationRequestStatus.ACCEPTED,
        sessionStatus: ConsultationSessionStatus.WAITING,
        requestedAt: new Date(),
        ...(snapshot ? { bookingSettingsSnapshot: snapshot } : {}),
      });
    const missing = await make();
    const existing = await make({
      cancellationDeadlineMinutes: 120,
      noShowAfterMinutes: 20,
    });
    await applyCc013BookingPolicy(connection.db!);
    expect(
      await connection
        .db!.collection('consultations')
        .findOne({ _id: missing._id }),
    ).toMatchObject({
      bookingSettingsSnapshot: {
        cancellationDeadlineMinutes: 60,
        noShowAfterMinutes: 10,
      },
    });
    expect(
      await connection
        .db!.collection('consultations')
        .findOne({ _id: existing._id }),
    ).toMatchObject({
      bookingSettingsSnapshot: {
        cancellationDeadlineMinutes: 120,
        noShowAfterMinutes: 20,
      },
    });
  });

  it('keeps cancellation and start consistent when they race', async () => {
    const patientId = await activeSubscription(1);
    const doctorId = new ObjectId().toHexString();
    const model = connection.model(Consultation.name);
    const service = new ConsultationsService(
      model as never,
      { create: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      usage,
      connection,
    );
    const consultation = await model.create({
      patientId: new ObjectId(patientId),
      doctorId: new ObjectId(doctorId),
      mode: ConsultationMode.ON_DEMAND,
      requestStatus: ConsultationRequestStatus.PENDING,
      sessionStatus: ConsultationSessionStatus.NOT_STARTED,
      requestedAt: new Date(),
    });
    await service.accept(doctorId, String(consultation._id));
    await Promise.allSettled([
      service.start(doctorId, String(consultation._id)),
      service.cancel(doctorId, String(consultation._id), {}),
    ]);
    const result = await connection
      .db!.collection('consultations')
      .findOne({ _id: consultation._id });
    const ledger = await connection
      .db!.collection('consultationusages')
      .findOne({ consultationId: consultation._id });
    if (result?.sessionStatus === ConsultationSessionStatus.NOT_STARTED)
      expect(ledger?.status).toBe('released');
    else {
      expect([
        ConsultationSessionStatus.IN_CONSULTATION,
        ConsultationSessionStatus.INTERRUPTED,
      ]).toContain(result?.sessionStatus);
      expect(ledger?.status).toBe('counted');
    }
  });

  it('exempts only explicitly selected legacy bookings, audits once, and permits start/cancel without quota', async () => {
    const patientId = new ObjectId();
    const doctorId = new ObjectId();
    const model = connection.model(Consultation.name);
    const create = () =>
      model.create({
        patientId,
        doctorId,
        mode: ConsultationMode.ON_DEMAND,
        requestStatus: ConsultationRequestStatus.ACCEPTED,
        sessionStatus: ConsultationSessionStatus.WAITING,
        requestedAt: new Date(),
      });
    const start = await create();
    const cancel = await create();
    const unmarked = await create();
    const client = connection.getClient() as unknown as MongoClient;
    const ids = [String(start._id), String(cancel._id)];
    expect(await exemptLegacyConsultations(client, ids)).toBe(2);
    expect(await exemptLegacyConsultations(client, ids)).toBe(0);
    expect(
      await connection.db!.collection('auditlogs').countDocuments({
        action: 'legacy_consultation_quota_exempted',
        entityId: { $in: [start._id, cancel._id] },
      }),
    ).toBe(2);
    const service = new ConsultationsService(
      model as never,
      { create: jest.fn() } as never,
      {} as never,
      usage,
      connection,
    );
    await service.start(String(doctorId), String(start._id));
    await service.cancel(String(doctorId), String(cancel._id), {});
    await expect(
      service.start(String(doctorId), String(unmarked._id)),
    ).rejects.toThrow('Consultation quota cannot be counted');
    expect(
      await connection
        .db!.collection('consultationusages')
        .countDocuments({ consultationId: { $in: [start._id, cancel._id] } }),
    ).toBe(0);
  });

  it('rejects legacy exemption if any selected consultation already has a ledger, rolling back the batch', async () => {
    const patientId = await activeSubscription(1);
    const model = connection.model(Consultation.name);
    const create = () =>
      model.create({
        patientId: new ObjectId(patientId),
        doctorId: new ObjectId(),
        mode: ConsultationMode.ON_DEMAND,
        requestStatus: ConsultationRequestStatus.ACCEPTED,
        sessionStatus: ConsultationSessionStatus.WAITING,
        requestedAt: new Date(),
      });
    const eligible = await create();
    const reserved = await create();
    await usage.reserve({ consultationId: String(reserved._id), patientId });
    await expect(
      exemptLegacyConsultations(
        connection.getClient() as unknown as MongoClient,
        [String(eligible._id), String(reserved._id)],
      ),
    ).rejects.toThrow('has a quota ledger');
    expect(
      await connection
        .db!.collection('consultations')
        .findOne({ _id: eligible._id }),
    ).not.toHaveProperty('legacyQuotaExempt');
    expect(
      await connection.db!.collection('auditlogs').countDocuments({
        action: 'legacy_consultation_quota_exempted',
        entityId: eligible._id,
      }),
    ).toBe(0);
  });

  it('normalizes legacy null dates within the audited exemption transaction under strict validation', async () => {
    await applyCc013LegacyExemption(connection.db!);
    const id = new ObjectId();
    const now = new Date();
    await connection.db!.collection('consultations').insertOne(
      {
        _id: id,
        patientId: new ObjectId(),
        doctorId: new ObjectId(),
        mode: 'on_demand',
        requestStatus: 'accepted',
        sessionStatus: 'waiting',
        requestedAt: now,
        expectedDurationMinutes: 30,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        sessionStartedAt: null,
      },
      { bypassDocumentValidation: true },
    );
    expect(
      await exemptLegacyConsultations(
        connection.getClient() as unknown as MongoClient,
        [String(id)],
      ),
    ).toBe(1);
    const record = await connection
      .db!.collection('consultations')
      .findOne({ _id: id });
    expect(record).toMatchObject({ legacyQuotaExempt: true });
    expect(record).not.toHaveProperty('completedAt');
    expect(record).not.toHaveProperty('sessionStartedAt');
    expect(
      await connection.db!.collection('auditlogs').findOne({
        entityId: id,
        action: 'legacy_consultation_quota_exempted',
      }),
    ).toMatchObject({
      metadata: { normalizedNullFields: ['completedAt', 'sessionStartedAt'] },
    });
  });

  it('warns, honors the durable grace period, then atomically system-cancels and releases a normal reservation', async () => {
    const patientId = await activeSubscription(1);
    const doctorId = new ObjectId();
    const model = connection.model(Consultation.name);
    const respondedAt = new Date('2026-10-21T00:00:00.000Z');
    const consultation = await model.create({
      patientId: new ObjectId(patientId),
      doctorId,
      mode: ConsultationMode.ON_DEMAND,
      requestStatus: ConsultationRequestStatus.ACCEPTED,
      sessionStatus: ConsultationSessionStatus.WAITING,
      requestedAt: respondedAt,
      respondedAt,
    });
    await usage.reserve({ consultationId: String(consultation._id), patientId });
    const recovery = new ConsultationStaleRecoveryService(
      model as never,
      connection.model(AuditLog.name) as never,
      connection,
      { run: async <T>(operation: Promise<T>) => operation, client: { get: jest.fn().mockResolvedValue(null) } } as never,
      { build: (...parts: string[]) => parts.join(':') } as never,
      new OutboxService(connection.model(OutboxEvent.name) as never),
      usage,
    );

    await recovery.recover(new Date(respondedAt.getTime() + 46 * 60_000));
    expect(await model.findById(consultation._id).lean()).toMatchObject({
      onDemandTimeoutWarningQueuedAt: expect.any(Date),
      requestStatus: ConsultationRequestStatus.ACCEPTED,
    });
    expect(await connection.model(OutboxEvent.name).countDocuments({ eventType: 'consultation.on-demand-timeout-warning' })).toBe(1);

    await recovery.recover(new Date(respondedAt.getTime() + 60 * 60_000));
    expect(await model.findById(consultation._id).lean()).toMatchObject({ requestStatus: ConsultationRequestStatus.ACCEPTED });

    await recovery.recover(new Date(respondedAt.getTime() + 61 * 60_000));
    expect(await model.findById(consultation._id).lean()).toMatchObject({
      requestStatus: ConsultationRequestStatus.CANCELLED,
      sessionStatus: ConsultationSessionStatus.NOT_STARTED,
      cancellationReason: 'system_timeout',
    });
    expect(await connection.db!.collection('consultationusages').findOne({ consultationId: consultation._id })).toMatchObject({ status: 'released' });
    expect(await connection.model(AuditLog.name).countDocuments({ entityId: consultation._id, action: 'on_demand_timeout_cancelled' })).toBe(1);
  });

  it('extends once for waiting-room presence, never creates a ledger for included care, and queues scheduled review without release', async () => {
    const model = connection.model(Consultation.name);
    const now = new Date('2026-10-21T00:00:00.000Z');
    const included = await model.create({
      patientId: new ObjectId(), doctorId: new ObjectId(), mode: ConsultationMode.ON_DEMAND,
      requestStatus: ConsultationRequestStatus.ACCEPTED, sessionStatus: ConsultationSessionStatus.WAITING,
      quotaPolicy: ConsultationQuotaPolicy.CARE_PROGRAM_INCLUDED, requestedAt: now, respondedAt: new Date(now.getTime() - 61 * 60_000),
      onDemandTimeoutWarningQueuedAt: new Date(now.getTime() - 16 * 60_000),
    });
    const scheduled = await model.create({
      patientId: new ObjectId(), doctorId: new ObjectId(), mode: ConsultationMode.SCHEDULED,
      requestStatus: ConsultationRequestStatus.ACCEPTED, sessionStatus: ConsultationSessionStatus.WAITING,
      requestedAt: now, scheduledStartAt: new Date(now.getTime() - 25 * 60 * 60_000),
    });
    const redisGet = jest.fn().mockResolvedValue('1');
    const recovery = new ConsultationStaleRecoveryService(
      model as never, connection.model(AuditLog.name) as never, connection,
      { run: async <T>(operation: Promise<T>) => operation, client: { get: redisGet } } as never,
      { build: (...parts: string[]) => parts.join(':') } as never,
      new OutboxService(connection.model(OutboxEvent.name) as never), usage,
    );
    await recovery.recover(now);
    expect(await model.findById(included._id).lean()).toMatchObject({ onDemandTimeoutExtensionExpiresAt: new Date(now.getTime() + 10 * 60_000) });
    expect(await model.findById(scheduled._id).lean()).toMatchObject({ scheduledStaleReviewQueuedAt: expect.any(Date), requestStatus: ConsultationRequestStatus.ACCEPTED });
    await recovery.recover(new Date(now.getTime() + 11 * 60_000));
    expect(await model.findById(included._id).lean()).toMatchObject({ requestStatus: ConsultationRequestStatus.CANCELLED });
    expect(await connection.db!.collection('consultationusages').countDocuments({ consultationId: included._id })).toBe(0);
  });

  it('defers cancellation when Redis cannot verify waiting-room presence, and remains consistent when recovery races Doctor start', async () => {
    const patientId = await activeSubscription(2);
    const doctorId = new ObjectId();
    const model = connection.model(Consultation.name);
    const now = new Date('2026-10-21T02:00:00.000Z');
    const create = () => model.create({
      patientId: new ObjectId(patientId), doctorId,
      mode: ConsultationMode.ON_DEMAND, requestStatus: ConsultationRequestStatus.ACCEPTED,
      sessionStatus: ConsultationSessionStatus.WAITING, requestedAt: now,
      respondedAt: new Date(now.getTime() - 61 * 60_000),
      onDemandTimeoutWarningQueuedAt: new Date(now.getTime() - 16 * 60_000),
    });
    const deferred = await create();
    await usage.reserve({ consultationId: String(deferred._id), patientId });
    const unavailableRecovery = new ConsultationStaleRecoveryService(
      model as never, connection.model(AuditLog.name) as never, connection,
      { run: async <T>(operation: Promise<T>) => operation, client: { get: jest.fn().mockRejectedValue(new Error('Redis unavailable')) } } as never,
      { build: (...parts: string[]) => parts.join(':') } as never,
      new OutboxService(connection.model(OutboxEvent.name) as never), usage,
    );
    await unavailableRecovery.recover(now);
    expect(await model.findById(deferred._id).lean()).toMatchObject({ requestStatus: ConsultationRequestStatus.ACCEPTED, sessionStatus: ConsultationSessionStatus.WAITING });

    const raced = await create();
    await usage.reserve({ consultationId: String(raced._id), patientId });
    const recovery = new ConsultationStaleRecoveryService(
      model as never, connection.model(AuditLog.name) as never, connection,
      { run: async <T>(operation: Promise<T>) => operation, client: { get: jest.fn().mockResolvedValue(null) } } as never,
      { build: (...parts: string[]) => parts.join(':') } as never,
      new OutboxService(connection.model(OutboxEvent.name) as never), usage,
    );
    const consultations = new ConsultationsService(model as never, { create: jest.fn() } as never, {} as never, usage, connection);
    await Promise.allSettled([recovery.recover(now), consultations.start(String(doctorId), String(raced._id))]);
    const result = (await model.findById(raced._id).lean()) as {
      requestStatus?: ConsultationRequestStatus;
      sessionStatus?: ConsultationSessionStatus;
    } | null;
    const ledger = await connection.db!.collection('consultationusages').findOne({ consultationId: raced._id });
    if (result?.requestStatus === ConsultationRequestStatus.CANCELLED) {
      expect(ledger?.status).toBe('released');
    } else {
      expect(result?.sessionStatus).toBe(ConsultationSessionStatus.IN_CONSULTATION);
      expect(ledger?.status).toBe('counted');
    }
  });

  it('enforces AI token/request quota atomically, commits once for retry, and releases provider failures', async () => {
    const patientId = await activeSubscription(10);
    const quota = new AiQuotaService(
      connection.model(AiUsageDaily.name) as never,
      connection.model(AiQuotaReservation.name) as never,
      connection.model(AuditLog.name) as never,
      connection,
      new FreeSubscriptionGrantService(connection.model(Plan.name) as never, connection.model(Subscription.name) as never),
    );
    const first = await quota.reserve({ userId: patientId, idempotencyKey: 'chat-one', estimatedInputTokens: 100, maxOutputTokens: 500 });
    const replay = await quota.reserve({ userId: patientId, idempotencyKey: 'chat-one', estimatedInputTokens: 100, maxOutputTokens: 500 });
    expect(replay.reservationId).toBe(first.reservationId);
    await quota.commit({ reservationId: first.reservationId, inputTokens: 100, outputTokens: 200 });
    await quota.release(first.reservationId);
    expect(await connection.model(AiUsageDaily.name).findOne({ userId: new ObjectId(patientId) }).lean()).toMatchObject({ chatRequestCount: 1, chatTotalTokens: 300, reservedTokens: 0 });

    const failed = await quota.reserve({ userId: patientId, idempotencyKey: 'provider-failed', estimatedInputTokens: 100, maxOutputTokens: 500 });
    await quota.release(failed.reservationId);
    expect(await connection.model(AiQuotaReservation.name).findById(failed.reservationId).lean()).toMatchObject({ status: 'released' });

    const missingUsage = await quota.reserve({ userId: patientId, idempotencyKey: 'usage-missing', estimatedInputTokens: 10, maxOutputTokens: 20 });
    await quota.markUsageReconciliationRequired(missingUsage.reservationId, 'provider_usage_metadata_missing');
    expect(await connection.model(AiQuotaReservation.name).findById(missingUsage.reservationId).lean()).toMatchObject({ status: 'usage_reconciliation_required', settlementFailureReason: 'provider_usage_metadata_missing' });
    expect(await connection.db!.collection('auditlogs').countDocuments({ action: 'ai_quota_usage_reconciliation_required' })).toBe(1);

    const results = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => quota.reserve({ userId: patientId, idempotencyKey: `race-${index}`, estimatedInputTokens: 1, maxOutputTokens: 1 })));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(8);
  });

  async function activeSubscription(limit: number) {
    const userId = new ObjectId();
    const now = new Date();
    await connection.model(Subscription.name).create({
      userId,
      planId,
      status: SubscriptionStatus.ACTIVE,
      source: SubscriptionSource.ADMIN_DEMO,
      planSnapshot: {
        ...snapshotPlan(planFixture() as Plan),
        consultationLimitPerCycle: limit,
      },
      cycleNumber: 1,
      currentPeriodStart: new Date(now.getTime() - 60_000),
      currentPeriodEnd: new Date(now.getTime() + 86_400_000),
      startedAt: now,
      expiresAt: new Date(now.getTime() + 86_400_000),
    });
    return userId.toHexString();
  }
});

function planFixture() {
  const createdBy = new ObjectId();
  return {
    code: 'FREE',
    version: 1,
    name: 'Free',
    price: 0,
    currency: 'VND',
    durationDays: 30,
    aiRequestLimit: 10,
    aiTokenLimit: 10_000,
    aiQuotaPeriod: 'day' as const,
    consultationLimitPerCycle: 1,
    activeCareProgramLimit: 1,
    benefits: {},
    refundPolicy: {},
    status: PlanStatus.PUBLISHED,
    createdBy,
    publishedBy: createdBy,
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}
