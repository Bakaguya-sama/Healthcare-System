import { ObjectId } from 'mongodb';
import { Connection, createConnection, Model, Types } from 'mongoose';
import { applyCc7PaymentOrders } from '../src/database/migrations/202610231000-cc7-payment-orders';
import { applyPatientPaymentOrderReadIndexes } from '../src/database/migrations/202611062000-patient-payment-order-read-indexes';
import { PatientPaymentOrderReadService } from '../src/modules/billing/application/services/patient-payment-order-read.service';
import {
  PaymentOrder,
  PaymentOrderDocument,
  PaymentOrderSchema,
  PaymentOrderStatus,
} from '../src/modules/billing/domain/entities/payment.entity';

jest.setTimeout(30_000);

const baseMongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_payment_order_read_test?replicaSet=rs0&directConnection=true';

function collectStages(
  value: unknown,
  stages = new Set<string>(),
): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectStages(item, stages);
    return stages;
  }
  if (!value || typeof value !== 'object') return stages;
  const record = value as Record<string, unknown>;
  if (typeof record.stage === 'string') stages.add(record.stage);
  for (const nested of Object.values(record)) collectStages(nested, stages);
  return stages;
}

describe('BILL-04 Patient PaymentOrder read', () => {
  let connection: Connection;
  let orders: Model<PaymentOrderDocument>;
  let reads: PatientPaymentOrderReadService;
  const patientId = new Types.ObjectId();
  const otherPatientId = new Types.ObjectId();
  const planId = new Types.ObjectId();

  beforeAll(async () => {
    const uri = new URL(baseMongoUri);
    uri.pathname = `/healthcare_payment_order_read_${new ObjectId().toHexString()}`;
    connection = await createConnection(uri.toString(), {
      autoIndex: false,
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    await applyCc7PaymentOrders(connection.db!);
    await applyPatientPaymentOrderReadIndexes(connection.db!);
    orders = connection.model<PaymentOrderDocument>(
      PaymentOrder.name,
      PaymentOrderSchema,
    );
    reads = new PatientPaymentOrderReadService(orders);
  });

  beforeEach(async () => {
    await orders.deleteMany({});
  });

  afterAll(async () => {
    if (!connection) return;
    await connection.dropDatabase();
    await connection.close();
  });

  it('scopes filter, total and projection to the JWT owner', async () => {
    const sharedCreatedAt = new Date('2026-11-06T08:00:00.000Z');
    await createOrder(patientId, PaymentOrderStatus.PAID, 'owner-paid', {
      createdAt: sharedCreatedAt,
      updatedAt: sharedCreatedAt,
      paidAt: sharedCreatedAt,
    });
    await createOrder(
      patientId,
      PaymentOrderStatus.CANCELLED,
      'owner-cancelled',
      {
        createdAt: sharedCreatedAt,
        updatedAt: sharedCreatedAt,
        cancelledAt: sharedCreatedAt,
      },
    );
    await createOrder(otherPatientId, PaymentOrderStatus.PAID, 'other-paid', {
      createdAt: sharedCreatedAt,
      updatedAt: sharedCreatedAt,
      paidAt: sharedCreatedAt,
    });

    const page = await reads.list(patientId.toHexString(), {
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: -1,
      status: PaymentOrderStatus.PAID,
    });

    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].orderCode).toContain('owner-paid');
    expect(page.items[0]).toMatchObject({
      status: PaymentOrderStatus.PAID,
      amount: 99_000,
      currency: 'VND',
      plan: { code: 'PLUS', version: 4, name: 'Plus historic snapshot' },
    });
    const serialized = JSON.stringify(page);
    expect(serialized).not.toContain(otherPatientId.toHexString());
    expect(serialized).not.toContain('idempotencyKey');
    expect(serialized).not.toContain('refundPolicy');
    expect(serialized).not.toContain('gatewayPayload');
  });

  it('uses _id as a stable tie-breaker across pages', async () => {
    const createdAt = new Date('2026-11-06T10:00:00.000Z');
    const first = await createOrder(
      patientId,
      PaymentOrderStatus.PENDING,
      'stable-first',
      { createdAt, updatedAt: createdAt },
    );
    const second = await createOrder(
      patientId,
      PaymentOrderStatus.PENDING,
      'stable-second',
      { createdAt, updatedAt: createdAt },
    );

    const pageOne = await reads.list(patientId.toHexString(), {
      page: 1,
      limit: 1,
      sortBy: 'createdAt',
      sortOrder: -1,
    });
    const pageTwo = await reads.list(patientId.toHexString(), {
      page: 2,
      limit: 1,
      sortBy: 'createdAt',
      sortOrder: -1,
    });

    expect(pageOne.total).toBe(2);
    expect(pageOne.totalPages).toBe(2);
    expect(pageOne.items[0].id).toBe(String(second._id));
    expect(pageTwo.items[0].id).toBe(String(first._id));
    expect(pageOne.items[0].id).not.toBe(pageTwo.items[0].id);
  });

  it('returns a valid empty page for a Patient with no orders', async () => {
    await expect(
      reads.list(new Types.ObjectId().toHexString(), {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: -1,
      }),
    ).resolves.toEqual({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('installs indexes for both status-filtered and unfiltered stable list shapes', async () => {
    const indexes = await connection.db!.collection('paymentorders').indexes();
    expect(indexes.map((index) => index.name)).toEqual(
      expect.arrayContaining([
        'userId_1_createdAt_-1__id_-1',
        'userId_1_status_1_createdAt_-1__id_-1',
      ]),
    );

    await createOrder(patientId, PaymentOrderStatus.PENDING, 'explain', {
      createdAt: new Date('2026-11-06T11:00:00.000Z'),
      updatedAt: new Date('2026-11-06T11:00:00.000Z'),
    });
    const cases = [
      {
        filter: { userId: patientId },
        index: 'userId_1_createdAt_-1__id_-1',
      },
      {
        filter: { userId: patientId, status: PaymentOrderStatus.PENDING },
        index: 'userId_1_status_1_createdAt_-1__id_-1',
      },
    ];
    for (const queryCase of cases) {
      const explain = await connection
        .db!.collection('paymentorders')
        .find(queryCase.filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(20)
        .hint(queryCase.index)
        .explain('executionStats');
      const record = explain as Record<string, unknown>;
      const planner =
        record.queryPlanner && typeof record.queryPlanner === 'object'
          ? (record.queryPlanner as Record<string, unknown>)
          : {};
      const stages = collectStages(planner.winningPlan);
      expect(stages).toContain('IXSCAN');
      expect(stages).not.toContain('COLLSCAN');
      expect(stages).not.toContain('SORT');
    }
  });

  async function createOrder(
    userId: Types.ObjectId,
    status: PaymentOrderStatus,
    suffix: string,
    timestamps: Record<string, Date>,
  ) {
    const token = new Types.ObjectId().toHexString();
    return orders.create({
      userId,
      planId,
      orderCode: `PAY_${suffix}_${token}`,
      idempotencyKey: `payment-read-${suffix}-${token}`,
      orderSnapshot: {
        code: 'PLUS',
        version: 4,
        name: 'Plus historic snapshot',
        durationDays: 30,
        aiRequestLimit: 40,
        aiTokenLimit: 120_000,
        aiQuotaPeriod: 'day',
        consultationLimitPerCycle: 3,
        activeCareProgramLimit: 2,
        benefits: { privateExecutionConfig: 'not-for-list' },
        refundPolicy: { internal: true },
        price: 99_000,
        currency: 'VND',
      },
      amount: 99_000,
      currency: 'VND',
      status,
      expiresAt: new Date('2026-11-06T10:15:00.000Z'),
      ...timestamps,
    });
  }
});
