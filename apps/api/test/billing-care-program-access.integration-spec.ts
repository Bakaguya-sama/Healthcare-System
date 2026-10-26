import { ObjectId } from 'mongodb';
import { Connection, createConnection } from 'mongoose';
import { applyCc012BillingAccess } from '../src/database/migrations/202610151000-cc012-billing-access';
import { FreeSubscriptionGrantService } from '../src/modules/billing/application/services/free-subscription-grant.service';
import { SubscriptionCareProgramAccessService } from '../src/modules/billing/application/services/subscription-care-program-access.service';
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

jest.setTimeout(30_000);

const baseMongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_cc012_test?replicaSet=rs0&directConnection=true';

describe('CC-012 billing-backed care program access', () => {
  let connection: Connection;
  let access: SubscriptionCareProgramAccessService;
  let planId: ObjectId;

  beforeAll(async () => {
    const uri = new URL(baseMongoUri);
    uri.pathname = `/healthcare_cc012_${new ObjectId().toHexString()}`;
    connection = await createConnection(uri.toString(), {
      autoIndex: false,
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    await applyCc012BillingAccess(connection.db!);
    const plans = connection.model(Plan.name, PlanSchema);
    const subscriptions = connection.model(
      Subscription.name,
      SubscriptionSchema,
    );
    const freePlan = await plans.create(planFixture());
    planId = freePlan._id;
    access = new SubscriptionCareProgramAccessService(
      new FreeSubscriptionGrantService(plans as never, subscriptions as never),
    );
  });

  afterAll(async () => {
    if (!connection) return;
    await connection.dropDatabase();
    await connection.close();
  });

  it('creates exactly one free grant and enforces its snapshotted limit', async () => {
    const patientId = new ObjectId().toHexString();
    await expect(
      access.checkCareProgramAccess({ patientId, activeProgramCount: 0 }),
    ).resolves.toEqual({ eligible: true, activeCareProgramLimit: 1 });
    await expect(
      access.checkCareProgramAccess({ patientId, activeProgramCount: 1 }),
    ).resolves.toEqual({
      eligible: false,
      reasonCode: 'active_care_program_limit_reached',
    });

    await connection
      .model(Plan.name)
      .updateOne({ _id: planId }, { $set: { activeCareProgramLimit: 9 } });
    await expect(
      access.checkCareProgramAccess({ patientId, activeProgramCount: 1 }),
    ).resolves.toEqual({
      eligible: false,
      reasonCode: 'active_care_program_limit_reached',
    });
    expect(
      await connection
        .db!.collection('subscriptions')
        .countDocuments({ userId: new ObjectId(patientId), status: 'active' }),
    ).toBe(1);
  });

  it('renews the same free record, expires a paid record, and falls back without deleting care data', async () => {
    const subscriptions = connection.model(Subscription.name);
    const patientId = new ObjectId();
    const oldEnd = new Date('2026-09-01T00:00:00.000Z');
    const free = await subscriptions.create({
      userId: patientId,
      planId,
      status: SubscriptionStatus.ACTIVE,
      source: SubscriptionSource.FREE_GRANT,
      planSnapshot: { ...planSnapshot(), activeCareProgramLimit: 1 },
      cycleNumber: 1,
      currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
      currentPeriodEnd: oldEnd,
      startedAt: new Date('2026-08-01T00:00:00.000Z'),
      expiresAt: oldEnd,
    });
    const renewalAt = new Date('2026-10-01T00:00:00.000Z');
    await access.checkCareProgramAccess({
      patientId: patientId.toHexString(),
      activeProgramCount: 0,
      checkedAt: renewalAt,
    });
    const renewed = await subscriptions.findById(free._id).lean();
    expect(renewed).toMatchObject({
      _id: free._id,
      status: SubscriptionStatus.ACTIVE,
      cycleNumber: 2,
      currentPeriodStart: renewalAt,
    });

    const paidPatientId = new ObjectId();
    const paid = await subscriptions.create({
      userId: paidPatientId,
      planId,
      status: SubscriptionStatus.ACTIVE,
      source: SubscriptionSource.ADMIN_DEMO,
      planSnapshot: { ...planSnapshot(), activeCareProgramLimit: 4 },
      cycleNumber: 1,
      currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
      currentPeriodEnd: oldEnd,
      startedAt: new Date('2026-08-01T00:00:00.000Z'),
      expiresAt: oldEnd,
    });
    await access.checkCareProgramAccess({
      patientId: paidPatientId.toHexString(),
      activeProgramCount: 0,
      checkedAt: renewalAt,
    });
    expect(await subscriptions.findById(paid._id).lean()).toMatchObject({
      status: SubscriptionStatus.EXPIRED,
    });
    expect(
      await subscriptions.findOne({
        userId: paidPatientId,
        source: SubscriptionSource.FREE_GRANT,
        status: SubscriptionStatus.ACTIVE,
      }),
    ).toBeTruthy();
  });

  it('does not fail open or create two active grants under concurrent checks', async () => {
    const patientId = new ObjectId().toHexString();
    const decisions = await Promise.all(
      Array.from({ length: 8 }, () =>
        access.checkCareProgramAccess({ patientId, activeProgramCount: 0 }),
      ),
    );
    expect(decisions).toEqual(
      Array.from({ length: 8 }, () => ({
        eligible: true,
        activeCareProgramLimit: 1,
      })),
    );
    expect(
      await connection
        .db!.collection('subscriptions')
        .countDocuments({ userId: new ObjectId(patientId), status: 'active' }),
    ).toBe(1);
  });
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

function planSnapshot() {
  return snapshotPlan({
    ...planFixture(),
  } as Plan);
}
