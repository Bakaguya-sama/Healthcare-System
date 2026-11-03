import { ObjectId } from 'mongodb';
import { Connection, createConnection, Model, Types } from 'mongoose';
import { applyCc012BillingAccess } from '../src/database/migrations/202610151000-cc012-billing-access';
import { applyCc7PaymentOrders } from '../src/database/migrations/202610231000-cc7-payment-orders';
import { applyRf9Outbox } from '../src/database/migrations/202609182500-rf9-outbox';
import { OutboxService } from '../src/infrastructure/outbox/outbox.service';
import { OutboxEvent, OutboxEventSchema } from '../src/infrastructure/outbox/entities/outbox-event.entity';
import { PaymentOrderService } from '../src/modules/billing/application/services/payment-order.service';
import { SubscriptionPaymentGrantService } from '../src/modules/billing/application/services/subscription-payment-grant.service';
import { Plan, PlanDocument, PlanSchema, PlanStatus } from '../src/modules/billing/domain/entities/plan.entity';
import { PaymentOrder, PaymentOrderDocument, PaymentOrderSchema, PaymentOrderStatus, PaymentTransaction, PaymentTransactionDocument, PaymentTransactionSchema } from '../src/modules/billing/domain/entities/payment.entity';
import { Subscription, SubscriptionDocument, SubscriptionSchema, SubscriptionSource, SubscriptionStatus } from '../src/modules/billing/domain/entities/subscription.entity';

jest.setTimeout(30_000);

const baseMongoUri = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27018/healthcare_cc7_test?replicaSet=rs0&directConnection=true';

describe('CC-7 payment state machine and grant recovery', () => {
  let connection: Connection;
  let plans: Model<PlanDocument>;
  let orders: Model<PaymentOrderDocument>;
  let subscriptions: Model<SubscriptionDocument>;
  let payments: PaymentOrderService;
  let grants: SubscriptionPaymentGrantService;
  let planId: Types.ObjectId;

  beforeAll(async () => {
    const uri = new URL(baseMongoUri);
    uri.pathname = `/healthcare_cc7_${new ObjectId().toHexString()}`;
    connection = await createConnection(uri.toString(), { autoIndex: false, serverSelectionTimeoutMS: 5_000 }).asPromise();
    await applyRf9Outbox(connection.db!);
    await applyCc012BillingAccess(connection.db!);
    await applyCc7PaymentOrders(connection.db!);
    plans = connection.model<PlanDocument>(Plan.name, PlanSchema);
    orders = connection.model<PaymentOrderDocument>(PaymentOrder.name, PaymentOrderSchema);
    const transactions = connection.model<PaymentTransactionDocument>(PaymentTransaction.name, PaymentTransactionSchema);
    subscriptions = connection.model<SubscriptionDocument>(Subscription.name, SubscriptionSchema);
    const outbox = new OutboxService(connection.model(OutboxEvent.name, OutboxEventSchema) as never);
    const provider = {
      createPaymentUrl: jest.fn(() => 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?test=1'),
      verifyNotification: jest.fn(async (query: Record<string, string | undefined>) => ({
        verified: query.signature === 'valid',
        successful: query.success === '00',
        orderCode: query.orderCode,
        amount: Number(query.amount),
        providerTransactionNo: query.providerTransactionNo,
        responseCode: query.success,
        bankCode: 'NCB',
        sanitizedPayload: { callback: 'redacted' },
      })),
    };
    payments = new PaymentOrderService(
      plans as never,
      orders as never,
      transactions as never,
      connection,
      outbox,
      { get: jest.fn((key: string) => key === 'VNPAY_ENABLED') } as never,
      provider,
      { toDataUrl: jest.fn(async () => 'data:image/png;base64,test') } as never,
      subscriptions as never,
    );
    grants = new SubscriptionPaymentGrantService(orders as never, subscriptions as never, connection);
    const createdBy = new Types.ObjectId();
    const plan = await plans.create({
      code: 'PLUS', version: 1, name: 'Plus', price: 99_000, currency: 'VND', durationDays: 30,
      aiRequestLimit: 40, aiTokenLimit: 120_000, aiQuotaPeriod: 'day', consultationLimitPerCycle: 3,
      activeCareProgramLimit: 2, benefits: {}, refundPolicy: {}, status: PlanStatus.PUBLISHED,
      createdBy, publishedBy: createdBy, publishedAt: new Date(),
    });
    planId = plan._id;
  });

  afterAll(async () => {
    if (!connection) return;
    await connection.dropDatabase();
    await connection.close();
  });

  it('rejects invalid signatures without creating a payment transaction', async () => {
    await expect(payments.handleIpn({ signature: 'invalid', success: '00', orderCode: 'UNKNOWN', amount: '9900000' })).resolves.toEqual({ RspCode: '97', Message: 'Invalid signature' });
    expect(await connection.db!.collection('paymenttransactions').countDocuments()).toBe(0);
  });

  it('accepts a late valid IPN once, deduplicates its replay, then reconciles a missing grant', async () => {
    const patientId = new Types.ObjectId();
    const order = await createOrder(patientId, PaymentOrderStatus.CANCELLED, 'late-ipn');
    const query = {
      signature: 'valid', success: '00', orderCode: order.orderCode, amount: '9900000', providerTransactionNo: 'late-provider-transaction',
    };
    await expect(payments.handleIpn(query)).resolves.toEqual({ RspCode: '00', Message: 'Confirm Success' });
    await expect(payments.handleIpn(query)).resolves.toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect(await orders.findById(order._id).lean()).toMatchObject({ status: PaymentOrderStatus.PAID });
    expect(await connection.db!.collection('paymenttransactions').countDocuments({ orderId: order._id })).toBe(1);
    expect(await connection.db!.collection('outboxevents').countDocuments({ 'payload.orderId': String(order._id) })).toBe(1);

    await expect(grants.reconcilePaidOrder(String(order._id))).resolves.toEqual({ repaired: true });
    await expect(grants.reconcilePaidOrder(String(order._id))).resolves.toEqual({ repaired: false });
    expect(await subscriptions.findOne({ sourceOrderId: order._id, status: SubscriptionStatus.ACTIVE }).lean()).toBeTruthy();
  });

  it('queues a paid renewal at the existing period end without overwriting it', async () => {
    const patientId = new Types.ObjectId();
    const currentPeriodEnd = new Date(Date.now() + 7 * 86_400_000);
    await subscriptions.create({
      userId: patientId, planId, sourceOrderId: new Types.ObjectId(), status: SubscriptionStatus.ACTIVE,
      source: SubscriptionSource.PAYMENT, planSnapshot: planSnapshot(), cycleNumber: 1,
      currentPeriodStart: new Date(), currentPeriodEnd, startedAt: new Date(), expiresAt: currentPeriodEnd,
    });
    const renewal = await createOrder(patientId, PaymentOrderStatus.PAID, 'renewal');
    await expect(grants.reconcilePaidOrder(String(renewal._id))).resolves.toEqual({ repaired: true });
    const active = await subscriptions.findOne({ userId: patientId, status: SubscriptionStatus.ACTIVE }).lean();
    expect(active).toMatchObject({ nextPlanOrderId: renewal._id, nextPlanStartsAt: currentPeriodEnd });
    expect(active?.currentPeriodEnd).toEqual(currentPeriodEnd);
  });

  async function createOrder(userId: Types.ObjectId, status: PaymentOrderStatus, suffix: string) {
    return orders.create({
      userId, planId, orderCode: `PAY_CC7_${suffix}_${new Types.ObjectId().toHexString()}`,
      idempotencyKey: `cc7-${suffix}-${new Types.ObjectId().toHexString()}`,
      orderSnapshot: { ...planSnapshot(), price: 99_000, currency: 'VND' }, amount: 99_000, currency: 'VND', status,
      expiresAt: new Date(Date.now() + 15 * 60_000), ...(status === PaymentOrderStatus.PAID ? { paidAt: new Date() } : {}),
    });
  }

  function planSnapshot() {
    return {
      code: 'PLUS', version: 1, name: 'Plus', durationDays: 30, aiRequestLimit: 40, aiTokenLimit: 120_000,
      aiQuotaPeriod: 'day' as const, consultationLimitPerCycle: 3, activeCareProgramLimit: 2, benefits: {},
    };
  }
});
