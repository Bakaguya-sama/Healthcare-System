import { PaymentOrderService } from './payment-order.service';
import { PaymentOrderStatus } from '../../domain/entities/payment.entity';

describe('PaymentOrderService IPN guards', () => {
  const makeService = (notification: object, order?: object) => {
    const orders = { findOne: jest.fn(() => ({ session: jest.fn().mockResolvedValue(order) })) };
    const connection = { transaction: async (callback: (session: unknown) => unknown) => callback({}) };
    return new PaymentOrderService({} as never, orders as never, {} as never, connection as never, {} as never, { get: jest.fn() } as never, { verifyNotification: jest.fn().mockResolvedValue(notification) } as never, { toDataUrl: jest.fn() } as never);
  };
  it('rejects an invalid signature before loading or mutating an order', async () => {
    const service = makeService({ verified: false, successful: true });
    await expect(service.handleIpn({ vnp_TxnRef: 'PAY1' })).resolves.toEqual({ RspCode: '97', Message: 'Invalid signature' });
  });
  it('rejects a validly signed callback whose VNPAY amount differs from the server order', async () => {
    const service = makeService({ verified: true, successful: true, orderCode: 'PAY1', amount: 999_900, sanitizedPayload: {} }, { _id: 'order', amount: 10_000, status: PaymentOrderStatus.PENDING });
    await expect(service.handleIpn({})).resolves.toEqual({ RspCode: '04', Message: 'Invalid amount' });
  });

  it('accepts a late valid IPN for a cancelled order and enqueues exactly one grant event', async () => {
    const order = { _id: 'order', amount: 10_000, status: PaymentOrderStatus.CANCELLED };
    const transactions = { findOneAndUpdate: jest.fn(() => ({ exec: jest.fn().mockResolvedValue({}) })) };
    const orders = {
      findOne: jest.fn(() => ({ session: jest.fn().mockResolvedValue(order) })),
      updateOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) })),
    };
    const outbox = { enqueue: jest.fn().mockResolvedValue({}) };
    const connection = { transaction: async (callback: (session: unknown) => unknown) => callback({}) };
    const service = new PaymentOrderService({} as never, orders as never, transactions as never, connection as never, outbox as never, {} as never, { verifyNotification: jest.fn().mockResolvedValue({ verified: true, successful: true, orderCode: 'PAY1', amount: 1_000_000, providerTransactionNo: 'late-1', sanitizedPayload: {} }) } as never, { toDataUrl: jest.fn() } as never);

    await expect(service.handleIpn({})).resolves.toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect(orders.updateOne).toHaveBeenCalledWith(expect.objectContaining({ status: { $in: expect.arrayContaining([PaymentOrderStatus.CANCELLED]) } }), expect.anything(), expect.anything());
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });

  it('does not enqueue another grant event when a duplicate valid IPN sees an already-paid order', async () => {
    const order = { _id: 'order', amount: 10_000, status: PaymentOrderStatus.PAID };
    const transactions = { findOneAndUpdate: jest.fn(() => ({ exec: jest.fn().mockResolvedValue({}) })) };
    const orders = {
      findOne: jest.fn(() => ({ session: jest.fn().mockResolvedValue(order) })),
      updateOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }) })),
    };
    const outbox = { enqueue: jest.fn() };
    const connection = { transaction: async (callback: (session: unknown) => unknown) => callback({}) };
    const service = new PaymentOrderService({} as never, orders as never, transactions as never, connection as never, outbox as never, {} as never, { verifyNotification: jest.fn().mockResolvedValue({ verified: true, successful: true, orderCode: 'PAY1', amount: 1_000_000, providerTransactionNo: 'duplicate-1', sanitizedPayload: {} }) } as never, { toDataUrl: jest.fn() } as never);

    await expect(service.handleIpn({})).resolves.toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});

describe('PaymentOrderService payment URL delivery', () => {
  it('generates a transient QR for the exact signed URL returned to the patient', async () => {
    const order = {
      _id: 'order-id',
      orderCode: 'PAY1',
      amount: 99_000,
      status: PaymentOrderStatus.CREATED,
      expiresAt: new Date(Date.now() + 60_000),
    };
    const orders = {
      updateOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue({}) })),
      findById: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(order) })),
    };
    const provider = {
      createPaymentUrl: jest
        .fn()
        .mockReturnValue('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?signed=1'),
    };
    const paymentQr = {
      toDataUrl: jest.fn().mockResolvedValue('data:image/png;base64,qr-image'),
    };
    const service = new PaymentOrderService(
      {} as never,
      orders as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      provider as never,
      paymentQr as never,
    );

    const result = await (service as never as {
      urlFor: (paymentOrder: typeof order, ipAddress: string) => Promise<unknown>;
    }).urlFor(order, '127.0.0.1');

    expect(paymentQr.toDataUrl).toHaveBeenCalledWith(
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?signed=1',
    );
    expect(result).toEqual({
      order,
      paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?signed=1',
      paymentQrDataUrl: 'data:image/png;base64,qr-image',
    });
  });
});
