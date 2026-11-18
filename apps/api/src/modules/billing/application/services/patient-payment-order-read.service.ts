import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { PageResult } from '../../../../common/pagination';
import {
  PaymentOrder,
  PaymentOrderDocument,
  PaymentOrderStatus,
} from '../../domain/entities/payment.entity';
import type { QueryPatientPaymentOrdersDto } from '../../presentation/dto/patient-payment-order-read.dto';

type PlainPaymentOrder = Record<string, unknown> & { _id: Types.ObjectId };

@Injectable()
export class PatientPaymentOrderReadService {
  constructor(
    @InjectModel(PaymentOrder.name)
    private readonly orders: Model<PaymentOrderDocument>,
  ) {}

  async list(
    patientId: string,
    query: QueryPatientPaymentOrdersDto,
  ): Promise<
    PageResult<ReturnType<PatientPaymentOrderReadService['project']>>
  > {
    const userId = this.objectId(patientId);
    const filter = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const sort = { createdAt: query.sortOrder, _id: query.sortOrder } as const;
    const [rows, total] = await Promise.all([
      this.orders
        .find(filter)
        .select(
          '_id orderCode orderSnapshot amount currency status expiresAt paidAt cancelledAt createdAt updatedAt',
        )
        .sort(sort)
        .skip(skip)
        .limit(query.limit)
        .lean()
        .exec(),
      this.orders.countDocuments(filter).exec(),
    ]);

    return {
      items: rows.map((row) =>
        this.project(row as unknown as PlainPaymentOrder),
      ),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  /**
   * BILL-05 is deliberately served by the same projection boundary as BILL-04.
   * PaymentOrder is a persistence aggregate and carries idempotency, provider,
   * grant and reconciliation-adjacent data that a Patient must never receive.
   */
  async get(patientId: string, orderId: string) {
    const userId = this.objectId(patientId);
    if (!Types.ObjectId.isValid(orderId))
      throw new HttpException(
        { code: 'BILLING_NOT_FOUND', message: 'Payment order not found' },
        HttpStatus.NOT_FOUND,
      );

    const row = await this.orders
      .findOne({ _id: new Types.ObjectId(orderId), userId })
      .select(
        '_id orderCode orderSnapshot amount currency status expiresAt paidAt cancelledAt createdAt updatedAt',
      )
      .lean()
      .exec();
    if (!row)
      throw new HttpException(
        { code: 'BILLING_NOT_FOUND', message: 'Payment order not found' },
        HttpStatus.NOT_FOUND,
      );
    return this.project(row as unknown as PlainPaymentOrder);
  }

  private project(order: PlainPaymentOrder) {
    const snapshot = this.record(order.orderSnapshot);
    const status = order.status;
    const amount = order.amount;
    const version = snapshot?.version;
    if (
      !Types.ObjectId.isValid(String(order._id)) ||
      typeof order.orderCode !== 'string' ||
      !Object.values(PaymentOrderStatus).includes(
        status as PaymentOrderStatus,
      ) ||
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount < 1 ||
      typeof order.currency !== 'string' ||
      !snapshot ||
      typeof snapshot.code !== 'string' ||
      typeof snapshot.name !== 'string' ||
      !Number.isSafeInteger(version) ||
      Number(version) < 1
    )
      this.unavailable();

    return {
      id: String(order._id),
      orderCode: order.orderCode,
      status: status as PaymentOrderStatus,
      amount,
      currency: order.currency,
      plan: {
        code: snapshot.code,
        name: snapshot.name,
        version: Number(version),
      },
      expiresAt: this.requiredIso(order.expiresAt),
      createdAt: this.requiredIso(order.createdAt),
      updatedAt: this.requiredIso(order.updatedAt),
      ...(this.iso(order.paidAt) ? { paidAt: this.iso(order.paidAt) } : {}),
      ...(this.iso(order.cancelledAt)
        ? { cancelledAt: this.iso(order.cancelledAt) }
        : {}),
    };
  }

  private objectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value))
      throw new HttpException(
        { code: 'BILLING_FORBIDDEN', message: 'Billing access is forbidden' },
        HttpStatus.FORBIDDEN,
      );
    return new Types.ObjectId(value);
  }

  private requiredIso(value: unknown): string {
    const iso = this.iso(value);
    if (!iso) this.unavailable();
    return iso;
  }

  private iso(value: unknown): string | undefined {
    if (value instanceof Date && !Number.isNaN(value.getTime()))
      return value.toISOString();
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    return undefined;
  }

  private record(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private unavailable(): never {
    throw new HttpException(
      {
        code: 'BILLING_PROJECTION_UNAVAILABLE',
        message: 'Payment order projection is unavailable',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
