import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import {
  PaymentOrder,
  PaymentOrderDocument,
  PaymentOrderStatus,
} from '../../domain/entities/payment.entity';
import {
  Subscription,
  SubscriptionDocument,
  SubscriptionSource,
  SubscriptionStatus,
} from '../../domain/entities/subscription.entity';

@Injectable()
export class SubscriptionPaymentGrantService {
  constructor(
    @InjectModel(PaymentOrder.name)
    private readonly orders: Model<PaymentOrderDocument>,
    @InjectModel(Subscription.name)
    private readonly subscriptions: Model<SubscriptionDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}
  async grantForPaidOrder(orderId: string) {
    return this.connection.transaction(async (session) => {
      const order = await this.orders
        .findOne({ _id: orderId, status: PaymentOrderStatus.PAID })
        .session(session);
      if (!order) throw new NotFoundException('Paid order not found');
      const alreadyGranted = await this.subscriptions
        .findOne({
          $or: [{ sourceOrderId: order._id }, { nextPlanOrderId: order._id }],
        })
        .session(session);
      if (alreadyGranted) return alreadyGranted;
      const now = new Date();
      const active = await this.subscriptions
        .findOne({
          userId: order.userId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: { $gt: now },
          expiresAt: { $gt: now },
        })
        .session(session);
      const durationMs = order.orderSnapshot.durationDays * 86_400_000;
      if (active?.source === SubscriptionSource.PAYMENT) {
        // A paid period is never shortened or overwritten; the purchase is queued.
        return this.subscriptions
          .findOneAndUpdate(
            { _id: active._id, nextPlanOrderId: { $exists: false } },
            {
              $set: {
                nextPlanId: order.planId,
                nextPlanSnapshot: order.orderSnapshot,
                nextPlanOrderId: order._id,
                nextPlanStartsAt: active.currentPeriodEnd,
              },
            },
            { new: true, session },
          )
          .exec();
      }
      if (active)
        await this.subscriptions
          .updateOne(
            { _id: active._id, status: SubscriptionStatus.ACTIVE },
            { $set: { status: SubscriptionStatus.EXPIRED, expiresAt: now } },
            { session },
          )
          .exec();
      const periodEnd = new Date(now.getTime() + durationMs);
      const [grant] = await this.subscriptions.create(
        [
          {
            userId: order.userId,
            planId: order.planId,
            sourceOrderId: order._id,
            status: SubscriptionStatus.ACTIVE,
            source: SubscriptionSource.PAYMENT,
            planSnapshot: order.orderSnapshot,
            cycleNumber: 1,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            startedAt: now,
            expiresAt: periodEnd,
          },
        ],
        { session },
      );
      return grant;
    });
  }
  async reconcilePaidWithoutGrant(limit = 100) {
    const paid = await this.orders
      .find({ status: PaymentOrderStatus.PAID })
      .sort({ paidAt: 1, _id: 1 })
      .limit(Math.max(1, Math.min(100, limit)))
      .lean();
    let repaired = 0;
    for (const order of paid) {
      const grant = await this.subscriptions.exists({
        $or: [{ sourceOrderId: order._id }, { nextPlanOrderId: order._id }],
      });
      if (!grant) {
        await this.grantForPaidOrder(String(order._id));
        repaired += 1;
      }
    }
    return { repaired };
  }
}
