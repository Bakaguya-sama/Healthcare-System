import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OutboxService } from '../../../../infrastructure/outbox/outbox.service';
import {
  PaymentOrder,
  PaymentOrderDocument,
  PaymentTransaction,
  PaymentTransactionDocument,
} from '../../domain/entities/payment.entity';
import {
  Subscription,
  SubscriptionDocument,
} from '../../domain/entities/subscription.entity';

/**
 * Admin-only operational projection. It deliberately excludes raw provider
 * payloads, signatures and retry error text.
 */
@Injectable()
export class PaymentEvidenceService {
  constructor(
    @InjectModel(PaymentOrder.name)
    private readonly orders: Model<PaymentOrderDocument>,
    @InjectModel(PaymentTransaction.name)
    private readonly transactions: Model<PaymentTransactionDocument>,
    @InjectModel(Subscription.name)
    private readonly subscriptions: Model<SubscriptionDocument>,
    private readonly outbox: OutboxService,
  ) {}

  async get(orderId: string) {
    if (!Types.ObjectId.isValid(orderId))
      throw new NotFoundException('Payment order not found');
    const order = await this.orders.findById(orderId).lean().exec();
    if (!order) throw new NotFoundException('Payment order not found');

    const [transaction, event, subscription] = await Promise.all([
      this.transactions
        .findOne({ orderId: order._id })
        .select('status responseCode bankCode providerTransactionNo ipnReceivedAt signatureVerifiedAt')
        .lean()
        .exec(),
      this.outbox.getLatestForAggregate('PaymentOrder', order._id),
      this.subscriptions
        .findOne({
          $or: [
            { sourceOrderId: order._id },
            { nextPlanOrderId: order._id },
          ],
        })
        .select('status source sourceOrderId nextPlanOrderId startedAt expiresAt nextPlanStartsAt')
        .lean()
        .exec(),
    ]);

    return {
      order: {
        id: String(order._id),
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        paidAt: order.paidAt ?? null,
      },
      transaction: transaction
        ? {
            status: transaction.status,
            responseCode: transaction.responseCode ?? null,
            bankCode: transaction.bankCode ?? null,
            providerTransactionNo: transaction.providerTransactionNo ?? null,
            ipnReceivedAt: transaction.ipnReceivedAt ?? null,
            signatureVerifiedAt: transaction.signatureVerifiedAt ?? null,
          }
        : null,
      outbox: event
        ? {
            status: event.status,
            attemptCount: event.attemptCount,
            maxAttempts: event.maxAttempts,
            deliveredAt: event.deliveredAt ?? null,
            hasLastError: Boolean(event.lastError),
          }
        : null,
      subscriptionGrant: subscription
        ? {
            status: subscription.status,
            source: subscription.source,
            grantMode:
              String(subscription.nextPlanOrderId ?? '') === String(order._id)
                ? 'queued'
                : 'immediate',
            startedAt: subscription.startedAt,
            expiresAt: subscription.expiresAt,
            nextPlanStartsAt: subscription.nextPlanStartsAt ?? null,
          }
        : null,
    };
  }
}
