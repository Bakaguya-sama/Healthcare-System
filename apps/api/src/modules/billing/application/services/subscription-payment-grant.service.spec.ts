import { SubscriptionPaymentGrantService } from './subscription-payment-grant.service';
import { PaymentOrderStatus } from '../../domain/entities/payment.entity';

describe('SubscriptionPaymentGrantService', () => {
  it('reconciles only paid orders without an existing immediate or queued grant', async () => {
    const paidOrders = [{ _id: 'missing-grant' }, { _id: 'already-granted' }];
    const orders = { find: jest.fn(() => ({ sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(paidOrders) })) };
    const subscriptions = { exists: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: 'grant' }) };
    const service = new SubscriptionPaymentGrantService(orders as never, subscriptions as never, {} as never);
    const grant = jest.spyOn(service, 'grantForPaidOrder').mockResolvedValue({} as never);

    await expect(service.reconcilePaidWithoutGrant(500)).resolves.toEqual({ repaired: 1 });
    expect(orders.find).toHaveBeenCalledWith({ status: PaymentOrderStatus.PAID });
    expect(grant).toHaveBeenCalledTimes(1);
    expect(grant).toHaveBeenCalledWith('missing-grant');
  });

  it('queues a renewal behind an active paid subscription instead of shortening it', async () => {
    const currentPeriodEnd = new Date('2026-12-01T00:00:00.000Z');
    const order = { _id: 'renewal-order', userId: 'patient', planId: 'plus', status: PaymentOrderStatus.PAID, orderSnapshot: { durationDays: 30 } };
    const active = { _id: 'active-subscription', source: 'payment', currentPeriodEnd, expiresAt: currentPeriodEnd };
    const orders = { findOne: jest.fn(() => ({ session: jest.fn().mockResolvedValue(order) })) };
    const subscriptions = {
      findOne: jest.fn()
        .mockImplementationOnce(() => ({ session: jest.fn().mockResolvedValue(null) }))
        .mockImplementationOnce(() => ({ session: jest.fn().mockResolvedValue(active) })),
      findOneAndUpdate: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(active) })),
    };
    const connection = { transaction: async (callback: (session: unknown) => unknown) => callback({}) };
    const service = new SubscriptionPaymentGrantService(orders as never, subscriptions as never, connection as never);

    await service.grantForPaidOrder('renewal-order');
    expect(subscriptions.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'active-subscription', nextPlanOrderId: { $exists: false } },
      expect.objectContaining({
        $set: expect.objectContaining({
          nextPlanOrderId: 'renewal-order',
          nextPlanStartsAt: currentPeriodEnd,
        }),
      }),
      expect.anything(),
    );
  });
});
