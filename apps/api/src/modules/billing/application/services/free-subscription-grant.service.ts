import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Plan,
  PlanDocument,
  PlanStatus,
  snapshotPlan,
} from '../../domain/entities/plan.entity';
import {
  Subscription,
  SubscriptionDocument,
  SubscriptionSource,
  SubscriptionStatus,
} from '../../domain/entities/subscription.entity';

@Injectable()
export class FreeSubscriptionGrantService {
  constructor(
    @InjectModel(Plan.name) private readonly plans: Model<PlanDocument>,
    @InjectModel(Subscription.name)
    private readonly subscriptions: Model<SubscriptionDocument>,
  ) {}

  async getEffectiveSubscription(
    patientId: string,
    now = new Date(),
  ): Promise<SubscriptionDocument | null> {
    if (!Types.ObjectId.isValid(patientId)) return null;
    const userId = new Types.ObjectId(patientId);
    const current = await this.findCurrent(userId, now);
    if (current) return current;

    const active = await this.subscriptions
      .findOne({ userId, status: SubscriptionStatus.ACTIVE })
      .exec();
    if (active?.source === SubscriptionSource.FREE_GRANT)
      return this.renewFreeGrant(active, now);
    if (active)
      await this.subscriptions
        .updateOne(
          {
            _id: active._id,
            status: SubscriptionStatus.ACTIVE,
            $or: [
              { currentPeriodEnd: { $lte: now } },
              { expiresAt: { $lte: now } },
            ],
          },
          { $set: { status: SubscriptionStatus.EXPIRED } },
        )
        .exec();

    const afterExpiry = await this.findCurrent(userId, now);
    if (afterExpiry) return afterExpiry;
    return this.createFreeGrant(userId, now);
  }

  private async findCurrent(userId: Types.ObjectId, now: Date) {
    return this.subscriptions
      .findOne({
        userId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: { $lte: now },
        currentPeriodEnd: { $gt: now },
        expiresAt: { $gt: now },
      })
      .exec();
  }

  private async currentFreePlan(now: Date) {
    return this.plans
      .findOne({
        code: 'FREE',
        status: PlanStatus.PUBLISHED,
        $and: [
          {
            $or: [
              { effectiveFrom: { $exists: false } },
              { effectiveFrom: { $lte: now } },
            ],
          },
          {
            $or: [
              { effectiveUntil: { $exists: false } },
              { effectiveUntil: { $gt: now } },
            ],
          },
        ],
      })
      .exec();
  }

  private async renewFreeGrant(
    subscription: SubscriptionDocument,
    now: Date,
  ): Promise<SubscriptionDocument | null> {
    const plan = await this.currentFreePlan(now);
    if (!plan) return null;
    const periodEnd = new Date(now.getTime() + plan.durationDays * 86_400_000);
    const renewed = await this.subscriptions
      .findOneAndUpdate(
        {
          _id: subscription._id,
          status: SubscriptionStatus.ACTIVE,
          source: SubscriptionSource.FREE_GRANT,
          $or: [
            { currentPeriodEnd: { $lte: now } },
            { expiresAt: { $lte: now } },
          ],
        },
        {
          $set: {
            planId: plan._id,
            planSnapshot: snapshotPlan(plan),
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            expiresAt: periodEnd,
            consultationUsageReserved: 0,
            consultationUsageCounted: 0,
          },
          $inc: { cycleNumber: 1 },
        },
        { new: true },
      )
      .exec();
    if (renewed) return renewed;
    return this.findCurrent(subscription.userId, now);
  }

  private async createFreeGrant(userId: Types.ObjectId, now: Date) {
    const plan = await this.currentFreePlan(now);
    if (!plan) return null;
    const periodEnd = new Date(now.getTime() + plan.durationDays * 86_400_000);
    try {
      return await this.subscriptions.create({
        userId,
        planId: plan._id,
        status: SubscriptionStatus.ACTIVE,
        source: SubscriptionSource.FREE_GRANT,
        planSnapshot: snapshotPlan(plan),
        cycleNumber: 1,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        startedAt: now,
        expiresAt: periodEnd,
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      return this.findCurrent(userId, now);
    }
  }
}
