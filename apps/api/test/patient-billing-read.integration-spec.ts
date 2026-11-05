import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { Connection, createConnection, Model } from 'mongoose';
import { migrateDatabase } from '../src/database/migrations/run-migrations';
import { PatientBillingReadService } from '../src/modules/billing/application/services/patient-billing-read.service';
import { FreeSubscriptionGrantService } from '../src/modules/billing/application/services/free-subscription-grant.service';
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

jest.setTimeout(45_000);

const baseMongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_billing_read_test?replicaSet=rs0&directConnection=true';

describe('P0 Patient Billing read API service', () => {
  let connection: Connection;
  let plans: Model<Plan>;
  let subscriptions: Model<Subscription>;
  let service: PatientBillingReadService;
  const patientId = new ObjectId();
  const otherPatientId = new ObjectId();
  const creatorId = new ObjectId();
  const now = new Date('2026-11-05T06:00:00.000Z');

  beforeAll(async () => {
    const uri = new URL(baseMongoUri);
    uri.pathname = `/healthcare_billing_read_${randomUUID().replaceAll('-', '')}`;
    const mongo = new MongoClient(uri.toString());
    await mongo.connect();
    await migrateDatabase(mongo.db());
    await mongo.close();
    connection = await createConnection(uri.toString(), {
      autoIndex: false,
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    plans = connection.model(Plan.name, PlanSchema);
    subscriptions = connection.model(Subscription.name, SubscriptionSchema);
    const grants = new FreeSubscriptionGrantService(
      plans as never,
      subscriptions as never,
    );
    service = new PatientBillingReadService(
      plans as never,
      subscriptions as never,
      grants,
    );
  });

  afterAll(async () => {
    if (!connection) return;
    await connection.dropDatabase();
    await connection.close();
  });

  beforeEach(async () => {
    await Promise.all([plans.deleteMany({}), subscriptions.deleteMany({})]);
  });

  it('lists only effective published Plans with stable pagination and a bounded projection', async () => {
    const first = await createPlan('A', PlanStatus.PUBLISHED, 100_000, {
      name: 'Same',
      benefits: { weeklyAiSummary: true, internalRule: 'do-not-leak' },
    });
    const second = await createPlan('B', PlanStatus.PUBLISHED, 200_000, {
      name: 'Same',
    });
    await createPlan('DRAFT', PlanStatus.DRAFT, 0);
    await createPlan('RETIRED', PlanStatus.RETIRED, 0);
    await createPlan('FUTURE', PlanStatus.PUBLISHED, 300_000, {
      effectiveFrom: new Date('2026-12-01T00:00:00Z'),
    });

    const page = await service.listPublishedPlans(
      planQuery({ sortBy: 'name', sortOrder: 1, limit: 1 }),
      now,
    );
    expect(page).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(page.items[0].id).toBe(String(first._id));
    const next = await service.listPublishedPlans(
      planQuery({ sortBy: 'name', sortOrder: 1, page: 2, limit: 1 }),
      now,
    );
    expect(next.items[0].id).toBe(String(second._id));
    expect(page.items[0]).toMatchObject({
      available: true,
      purchasable: true,
      benefits: { weeklyAiSummary: true },
    });
    expect(page.items[0]).not.toHaveProperty('refundPolicy');
    expect(page.items[0]).not.toHaveProperty('createdBy');
    expect(page.items[0].benefits).not.toHaveProperty('internalRule');
  });

  it('does not expose draft, retired, future or invalid Plan details', async () => {
    const published = await createPlan('PLUS', PlanStatus.PUBLISHED, 100_000);
    const draft = await createPlan('DRAFT', PlanStatus.DRAFT, 100_000);
    await expect(
      service.getPublishedPlan(String(published._id), now),
    ).resolves.toMatchObject({ id: String(published._id), code: 'PLUS' });
    await expect(
      service.getPublishedPlan(String(draft._id), now),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.getPublishedPlan('invalid', now),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it('returns only JWT-owned history and uses the immutable snapshot for effective entitlement', async () => {
    const plan = await createPlan('PLUS', PlanStatus.PUBLISHED, 100_000, {
      consultationLimitPerCycle: 99,
    });
    const immutable = {
      ...snapshotPlan(plan),
      consultationLimitPerCycle: 4,
      benefits: { weeklyAiSummary: true, secretProviderFlag: true },
    };
    const current = await createSubscription(
      patientId,
      plan._id as ObjectId,
      immutable,
      {
        status: SubscriptionStatus.ACTIVE,
        startedAt: new Date('2026-11-01T00:00:00Z'),
      },
    );
    await createSubscription(patientId, plan._id as ObjectId, immutable, {
      status: SubscriptionStatus.EXPIRED,
      startedAt: new Date('2026-10-01T00:00:00Z'),
      periodStart: new Date('2026-10-01T00:00:00Z'),
      periodEnd: new Date('2026-10-31T00:00:00Z'),
    });
    await createSubscription(otherPatientId, plan._id as ObjectId, immutable, {
      status: SubscriptionStatus.EXPIRED,
      startedAt: new Date('2026-09-01T00:00:00Z'),
      periodStart: new Date('2026-09-01T00:00:00Z'),
      periodEnd: new Date('2026-09-30T00:00:00Z'),
    });

    const result = await service.listPatientSubscriptions(
      patientId.toHexString(),
      subscriptionQuery(),
      now,
    );
    expect(result.total).toBe(2);
    expect(result.effective).toMatchObject({
      subscriptionId: String(current._id),
      entitlement: { consultationLimitPerCycle: 4 },
    });
    expect(result.effective?.entitlement.benefits).not.toHaveProperty(
      'secretProviderFlag',
    );
    expect(result.effective).not.toHaveProperty('sourceOrderId');
    expect(result.effective).not.toHaveProperty('nextPlanOrderId');
    expect(
      result.items.every((item) => item.subscriptionId !== undefined),
    ).toBe(true);
  });

  it('derives available from the same current-cycle atomic counters as Scheduled Booking', async () => {
    const plan = await createPlan('PLUS', PlanStatus.PUBLISHED, 100_000, {
      consultationLimitPerCycle: 4,
    });
    const subscription = await createSubscription(
      patientId,
      plan._id as ObjectId,
      snapshotPlan(plan),
      {
        status: SubscriptionStatus.ACTIVE,
        reserved: 1,
        counted: 1,
      },
    );
    const usage = await service.getPatientUsage(patientId.toHexString(), now);
    expect(usage).toEqual({
      subscriptionId: String(subscription._id),
      cycle: {
        number: 1,
        startedAt: '2026-11-01T00:00:00.000Z',
        endsAt: '2026-12-01T00:00:00.000Z',
      },
      consultations: {
        limit: 4,
        counted: 1,
        reserved: 1,
        available: 2,
        unlimited: false,
      },
      asOf: now.toISOString(),
    });
  });

  it('fails closed for corrupt counters and has an explicit no-current behavior', async () => {
    const noCurrent = await service.listPatientSubscriptions(
      patientId.toHexString(),
      subscriptionQuery(),
      now,
    );
    expect(noCurrent.effective).toBeNull();
    await expect(
      service.getPatientUsage(patientId.toHexString(), now),
    ).rejects.toMatchObject({ status: 404 });

    const plan = await createPlan('PLUS', PlanStatus.PUBLISHED, 100_000, {
      consultationLimitPerCycle: 1,
    });
    await createSubscription(
      patientId,
      plan._id as ObjectId,
      snapshotPlan(plan),
      {
        status: SubscriptionStatus.ACTIVE,
        reserved: 1,
        counted: 1,
      },
    );
    await expect(
      service.getPatientUsage(patientId.toHexString(), now),
    ).rejects.toMatchObject({ status: 503 });
  });

  async function createPlan(
    code: string,
    status: PlanStatus,
    price: number,
    overrides: Record<string, unknown> = {},
  ) {
    return plans.create({
      code,
      version: 1,
      name: code,
      description: `Public ${code}`,
      price,
      currency: 'VND',
      durationDays: 30,
      aiRequestLimit: 10,
      aiTokenLimit: 10_000,
      aiQuotaPeriod: 'subscription_cycle',
      consultationLimitPerCycle: 4,
      activeCareProgramLimit: 1,
      benefits: { weeklyAiSummary: true },
      refundPolicy: { internal: true },
      status,
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      createdBy: creatorId,
      ...overrides,
    });
  }

  async function createSubscription(
    userId: ObjectId,
    planId: ObjectId,
    planSnapshot: Record<string, unknown>,
    options: {
      status: SubscriptionStatus;
      startedAt?: Date;
      periodStart?: Date;
      periodEnd?: Date;
      reserved?: number;
      counted?: number;
    },
  ) {
    const periodStart = options.periodStart ?? new Date('2026-11-01T00:00:00Z');
    const periodEnd = options.periodEnd ?? new Date('2026-12-01T00:00:00Z');
    return subscriptions.create({
      userId,
      planId,
      status: options.status,
      source: SubscriptionSource.PAYMENT,
      planSnapshot,
      cycleNumber: 1,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      startedAt: options.startedAt ?? periodStart,
      expiresAt: periodEnd,
      consultationUsageReserved: options.reserved ?? 0,
      consultationUsageCounted: options.counted ?? 0,
    });
  }
});

function planQuery(overrides: Record<string, unknown> = {}) {
  return {
    page: 1,
    limit: 20,
    sortBy: 'code' as const,
    sortOrder: 1 as const,
    ...overrides,
  } as never;
}

function subscriptionQuery(overrides: Record<string, unknown> = {}) {
  return {
    page: 1,
    limit: 20,
    sortBy: 'startedAt' as const,
    sortOrder: -1 as const,
    ...overrides,
  } as never;
}
