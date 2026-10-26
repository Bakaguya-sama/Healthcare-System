import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { OutboxService } from '../../../../infrastructure/outbox/outbox.service';
import {
  Plan,
  PlanDocument,
  PlanStatus,
  snapshotPlan,
} from '../../domain/entities/plan.entity';
import {
  PaymentOrder,
  PaymentOrderDocument,
  PaymentOrderStatus,
  PaymentTransaction,
  PaymentTransactionDocument,
  PaymentTransactionStatus,
} from '../../domain/entities/payment.entity';
import { PAYMENT_PROVIDER } from '../ports/payment-provider.port';
import type { PaymentProviderPort } from '../ports/payment-provider.port';
import { Inject } from '@nestjs/common';
import { PaymentQrService } from '../../infrastructure/qr/payment-qr.service';

@Injectable()
export class PaymentOrderService {
  constructor(
    @InjectModel(Plan.name) private readonly plans: Model<PlanDocument>,
    @InjectModel(PaymentOrder.name)
    private readonly orders: Model<PaymentOrderDocument>,
    @InjectModel(PaymentTransaction.name)
    private readonly transactions: Model<PaymentTransactionDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly outbox: OutboxService,
    private readonly config: ConfigService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProviderPort,
    private readonly paymentQr: PaymentQrService,
  ) {}
  async create(
    userId: string,
    planId: string,
    idempotencyKey: string,
    ipAddress: string,
  ) {
    if (!this.config.get<boolean>('VNPAY_ENABLED')) {
      throw new BadRequestException('VNPAY payments are not available');
    }
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(planId))
      throw new BadRequestException('Invalid payment order identifier');
    if (!idempotencyKey?.trim())
      throw new BadRequestException('Idempotency-Key header is required');
    const existing = await this.orders
      .findOne({ idempotencyKey: idempotencyKey.trim() })
      .exec();
    if (existing) {
      if (String(existing.userId) !== userId)
        throw new ConflictException('Idempotency key is already in use');
      return this.urlFor(existing, ipAddress);
    }
    const plan = await this.plans
      .findOne({
        _id: planId,
        status: PlanStatus.PUBLISHED,
        $or: [
          { effectiveUntil: { $exists: false } },
          { effectiveUntil: { $gt: new Date() } },
        ],
      })
      .exec();
    if (!plan || plan.price <= 0 || plan.currency !== 'VND')
      throw new BadRequestException('Plan is not available for VNPAY payment');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60_000);
    const orderCode = `PAY${now.getTime()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    try {
      const order = await this.orders.create({
        userId: new Types.ObjectId(userId),
        planId: plan._id,
        orderCode,
        idempotencyKey: idempotencyKey.trim(),
        orderSnapshot: {
          ...snapshotPlan(plan),
          price: plan.price,
          currency: plan.currency,
        },
        amount: plan.price,
        currency: plan.currency,
        status: PaymentOrderStatus.CREATED,
        expiresAt,
      });
      return this.urlFor(order, ipAddress);
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const retry = await this.orders
        .findOne({ idempotencyKey: idempotencyKey.trim() })
        .exec();
      if (!retry || String(retry.userId) !== userId)
        throw new ConflictException('Unable to create payment order');
      return this.urlFor(retry, ipAddress);
    }
  }
  private async urlFor(order: PaymentOrderDocument, ipAddress: string) {
    if (
      [
        PaymentOrderStatus.CANCELLED,
        PaymentOrderStatus.PAID,
        PaymentOrderStatus.EXPIRED,
      ].includes(order.status)
    )
      return { order, paymentUrl: null, paymentQrDataUrl: null };
    if (order.expiresAt <= new Date()) {
      await this.orders
        .updateOne(
          {
            _id: order._id,
            status: {
              $in: [PaymentOrderStatus.CREATED, PaymentOrderStatus.PENDING],
            },
            expiresAt: { $lte: new Date() },
          },
          { $set: { status: PaymentOrderStatus.EXPIRED } },
        )
        .exec();
      return {
        order: await this.orders.findById(order._id).exec(),
        paymentUrl: null,
        paymentQrDataUrl: null,
      };
    }
    const paymentUrl = this.provider.createPaymentUrl({
      orderCode: order.orderCode,
      amount: order.amount,
      ipAddress,
      expiresAt: order.expiresAt,
    });
    const paymentQrDataUrl = await this.paymentQr.toDataUrl(paymentUrl);
    await this.orders
      .updateOne(
        { _id: order._id, status: PaymentOrderStatus.CREATED },
        { $set: { status: PaymentOrderStatus.PENDING } },
      )
      .exec();
    return {
      order: await this.orders.findById(order._id).exec(),
      paymentUrl,
      paymentQrDataUrl,
    };
  }
  async cancel(userId: string, orderId: string) {
    if (!Types.ObjectId.isValid(orderId))
      throw new BadRequestException('Invalid order ID');
    const order = await this.orders
      .findOneAndUpdate(
        {
          _id: orderId,
          userId: new Types.ObjectId(userId),
          status: {
            $in: [PaymentOrderStatus.CREATED, PaymentOrderStatus.PENDING],
          },
        },
        {
          $set: {
            status: PaymentOrderStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelledBy: new Types.ObjectId(userId),
            cancellationReason: 'user_cancelled',
          },
        },
        { new: true },
      )
      .exec();
    if (!order) throw new NotFoundException('Unpaid order not found');
    return order;
  }
  async getForUser(userId: string, orderId: string) {
    if (!Types.ObjectId.isValid(orderId))
      throw new BadRequestException('Invalid order ID');
    const order = await this.orders
      .findOne({ _id: orderId, userId: new Types.ObjectId(userId) })
      .lean()
      .exec();
    if (!order) throw new NotFoundException('Payment order not found');
    return order;
  }
  async handleIpn(query: Record<string, string | undefined>) {
    const notification = await this.provider.verifyNotification(query);
    if (!notification.verified)
      return { RspCode: '97', Message: 'Invalid signature' };
    if (!notification.orderCode || !notification.amount)
      return { RspCode: '01', Message: 'Order not found' };
    return this.connection.transaction(async (session) => {
      const order = await this.orders
        .findOne({ orderCode: notification.orderCode })
        .session(session);
      if (!order) return { RspCode: '01', Message: 'Order not found' };
      if (notification.amount !== order.amount * 100)
        return { RspCode: '04', Message: 'Invalid amount' };
      if (!notification.successful) {
        await this.transactions
          .findOneAndUpdate(
            { transactionRef: order.orderCode },
            {
              $setOnInsert: {
                orderId: order._id,
                provider: 'vnpay',
                transactionRef: order.orderCode,
                amount: order.amount,
              },
              $set: {
                status: PaymentTransactionStatus.FAILED,
                responseCode: notification.responseCode,
                bankCode: notification.bankCode,
                ipnReceivedAt: new Date(),
                signatureVerifiedAt: new Date(),
                gatewayPayload: notification.sanitizedPayload,
              },
            },
            { upsert: true, session },
          )
          .exec();
        return { RspCode: '00', Message: 'Confirm Success' };
      }
      await this.transactions
        .findOneAndUpdate(
          { transactionRef: order.orderCode },
          {
            $setOnInsert: {
              orderId: order._id,
              provider: 'vnpay',
              transactionRef: order.orderCode,
              amount: order.amount,
            },
            $set: {
              status: PaymentTransactionStatus.SUCCEEDED,
              providerTransactionNo: notification.providerTransactionNo,
              responseCode: notification.responseCode,
              bankCode: notification.bankCode,
              ipnReceivedAt: new Date(),
              signatureVerifiedAt: new Date(),
              gatewayPayload: notification.sanitizedPayload,
            },
          },
          { upsert: true, session },
        )
        .exec();
      const changed = await this.orders
        .updateOne(
          {
            _id: order._id,
            status: {
              $in: [
                PaymentOrderStatus.CREATED,
                PaymentOrderStatus.PENDING,
                PaymentOrderStatus.CANCELLED,
                PaymentOrderStatus.EXPIRED,
              ],
            },
          },
          { $set: { status: PaymentOrderStatus.PAID, paidAt: new Date() } },
          { session },
        )
        .exec();
      if (changed.modifiedCount)
        await this.outbox.enqueue(
          {
            eventType: 'subscription.grant.requested',
            aggregateType: 'PaymentOrder',
            aggregateId: order._id,
            payload: { orderId: String(order._id) },
            idempotencyKey: `subscription.grant.requested.${order._id}`,
          },
          session,
        );
      return { RspCode: '00', Message: 'Confirm Success' };
    });
  }
}
