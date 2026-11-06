import { Types } from 'mongoose';
import { PaymentOrderStatus } from '../../domain/entities/payment.entity';
import { PatientPaymentOrderReadService } from './patient-payment-order-read.service';

describe('PatientPaymentOrderReadService', () => {
  const patientId = new Types.ObjectId().toHexString();
  const now = new Date('2026-11-06T09:00:00.000Z');

  function serviceWith(rows: object[], total = rows.length) {
    const exec = jest.fn().mockResolvedValue(rows);
    const limit = jest.fn(() => ({ lean: () => ({ exec }) }));
    const skip = jest.fn(() => ({ limit }));
    const sort = jest.fn(() => ({ skip }));
    const select = jest.fn(() => ({ sort }));
    const find = jest.fn(() => ({ select }));
    const countExec = jest.fn().mockResolvedValue(total);
    const countDocuments = jest.fn(() => ({ exec: countExec }));
    return {
      service: new PatientPaymentOrderReadService({
        find,
        countDocuments,
      } as never),
      find,
      select,
      sort,
      skip,
      limit,
      countDocuments,
    };
  }

  it('scopes by JWT owner, applies stable pagination, and returns a bounded snapshot projection', async () => {
    const row = {
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(patientId),
      planId: new Types.ObjectId(),
      orderCode: 'PAY_HISTORY_1',
      idempotencyKey: 'secret-idempotency-key',
      orderSnapshot: {
        code: 'PLUS',
        version: 3,
        name: 'Plus immutable',
        benefits: { internal: true },
        refundPolicy: { internal: true },
      },
      amount: 99_000,
      currency: 'VND',
      status: PaymentOrderStatus.PAID,
      expiresAt: now,
      paidAt: now,
      createdAt: now,
      updatedAt: now,
      gatewayPayload: { secret: true },
    };
    const harness = serviceWith([row], 1);

    const result = await harness.service.list(patientId, {
      page: 2,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: -1,
      status: PaymentOrderStatus.PAID,
    });

    expect(harness.find).toHaveBeenCalledWith({
      userId: new Types.ObjectId(patientId),
      status: PaymentOrderStatus.PAID,
    });
    expect(harness.countDocuments).toHaveBeenCalledWith({
      userId: new Types.ObjectId(patientId),
      status: PaymentOrderStatus.PAID,
    });
    expect(harness.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(harness.skip).toHaveBeenCalledWith(10);
    expect(harness.limit).toHaveBeenCalledWith(10);
    expect(result).toEqual({
      items: [
        {
          id: String(row._id),
          orderCode: 'PAY_HISTORY_1',
          status: PaymentOrderStatus.PAID,
          amount: 99_000,
          currency: 'VND',
          plan: { code: 'PLUS', version: 3, name: 'Plus immutable' },
          expiresAt: now.toISOString(),
          paidAt: now.toISOString(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
    expect(JSON.stringify(result)).not.toContain('idempotencyKey');
    expect(JSON.stringify(result)).not.toContain('gatewayPayload');
    expect(JSON.stringify(result)).not.toContain('benefits');
  });

  it('returns an empty page instead of an error', async () => {
    const { service } = serviceWith([], 0);
    await expect(
      service.list(patientId, {
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

  it('fails closed when the immutable snapshot cannot produce a safe projection', async () => {
    const { service } = serviceWith([
      {
        _id: new Types.ObjectId(),
        orderCode: 'PAY_CORRUPT',
        orderSnapshot: { code: 'PLUS' },
        amount: 99_000,
        currency: 'VND',
        status: PaymentOrderStatus.PAID,
        expiresAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await expect(
      service.list(patientId, {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: -1,
      }),
    ).rejects.toMatchObject({ status: 503 });
  });
});
