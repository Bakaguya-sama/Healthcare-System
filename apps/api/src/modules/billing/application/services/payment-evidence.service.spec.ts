import { Types } from 'mongoose';
import { PaymentEvidenceService } from './payment-evidence.service';

describe('PaymentEvidenceService', () => {
  it('returns the operational chain without raw provider payload or outbox error', async () => {
    const orderId = new Types.ObjectId();
    const order = { _id: orderId, status: 'paid', amount: 99_000, currency: 'VND', paidAt: new Date('2026-10-22T16:19:17.170Z') };
    const transaction = { status: 'succeeded', responseCode: '00', bankCode: 'NCB', providerTransactionNo: '15712349', ipnReceivedAt: order.paidAt, signatureVerifiedAt: order.paidAt, gatewayPayload: { vnp_SecureHash: 'must-not-leak' } };
    const subscription = { status: 'active', source: 'payment', sourceOrderId: orderId, startedAt: order.paidAt, expiresAt: new Date('2026-11-21T16:19:17.170Z') };
    const chain = (value: unknown) => ({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(value) });
    const orders = { findById: jest.fn(() => ({ lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(order) })) };
    const transactions = { findOne: jest.fn(() => chain(transaction)) };
    const subscriptions = { findOne: jest.fn(() => chain(subscription)) };
    const outbox = { getLatestForAggregate: jest.fn().mockResolvedValue({ status: 'delivered', attemptCount: 1, maxAttempts: 8, deliveredAt: order.paidAt, lastError: 'must-not-leak' }) };
    const service = new PaymentEvidenceService(orders as never, transactions as never, subscriptions as never, outbox as never);

    await expect(service.get(String(orderId))).resolves.toEqual(expect.objectContaining({
      order: expect.objectContaining({ status: 'paid', amount: 99_000 }),
      transaction: expect.objectContaining({ status: 'succeeded', providerTransactionNo: '15712349' }),
      outbox: expect.objectContaining({ status: 'delivered', hasLastError: true }),
      subscriptionGrant: expect.objectContaining({ grantMode: 'immediate', status: 'active' }),
    }));
    const result = await service.get(String(orderId));
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });

  it('labels a purchase queued behind an existing paid subscription', async () => {
    const orderId = new Types.ObjectId();
    const previousOrderId = new Types.ObjectId();
    const chain = (value: unknown) => ({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(value) });
    const orders = { findById: jest.fn(() => ({ lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue({ _id: orderId, status: 'paid', amount: 99_000, currency: 'VND' }) })) };
    const transactions = { findOne: jest.fn(() => chain(null)) };
    const subscriptions = { findOne: jest.fn(() => chain({ status: 'active', source: 'payment', sourceOrderId: previousOrderId, nextPlanOrderId: orderId, startedAt: new Date(), expiresAt: new Date(), nextPlanStartsAt: new Date() })) };
    const service = new PaymentEvidenceService(orders as never, transactions as never, subscriptions as never, { getLatestForAggregate: jest.fn().mockResolvedValue(null) } as never);

    await expect(service.get(String(orderId))).resolves.toMatchObject({
      subscriptionGrant: { grantMode: 'queued', status: 'active' },
    });
  });
});
