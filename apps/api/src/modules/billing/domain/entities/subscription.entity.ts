import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import type { PlanSnapshot } from './plan.entity';

export type SubscriptionDocument = HydratedDocument<Subscription>;

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum SubscriptionSource {
  PAYMENT = 'payment',
  FREE_GRANT = 'free_grant',
  ADMIN_DEMO = 'admin_demo',
}

@Schema({ timestamps: true, collection: 'subscriptions' })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Plan', required: true })
  planId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'PaymentOrder' })
  sourceOrderId?: Types.ObjectId;
  @Prop({ required: true, enum: SubscriptionStatus })
  status: SubscriptionStatus;
  @Prop({ required: true, enum: SubscriptionSource })
  source: SubscriptionSource;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  planSnapshot: PlanSnapshot;
  @Prop({ type: Types.ObjectId, ref: 'Plan' }) nextPlanId?: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.Mixed }) nextPlanSnapshot?: PlanSnapshot;
  @Prop({ type: Types.ObjectId, ref: 'PaymentOrder' })
  nextPlanOrderId?: Types.ObjectId;
  @Prop() nextPlanStartsAt?: Date;
  @Prop({ required: true, min: 1, default: 1 }) cycleNumber: number;
  @Prop({ required: true }) currentPeriodStart: Date;
  @Prop({ required: true }) currentPeriodEnd: Date;
  @Prop({ required: true }) startedAt: Date;
  @Prop({ required: true }) expiresAt: Date;
  /** Atomic counters for the current subscription cycle's consultation ledger. */
  @Prop({ required: true, min: 0, default: 0 }) consultationUsageReserved: number;
  @Prop({ required: true, min: 0, default: 0 }) consultationUsageCounted: number;
  @Prop() cancelledAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) cancelledBy?: Types.ObjectId;
  @Prop({ maxlength: 64 }) cancellationReason?: string;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
SubscriptionSchema.index(
  { sourceOrderId: 1 },
  { name: 'sourceOrderId_1', unique: true, sparse: true },
);
SubscriptionSchema.index(
  { nextPlanOrderId: 1 },
  { name: 'nextPlanOrderId_1', unique: true, sparse: true },
);
SubscriptionSchema.index(
  { userId: 1, status: 1 },
  {
    name: 'userId_1_status_active_unique',
    unique: true,
    partialFilterExpression: { status: SubscriptionStatus.ACTIVE },
  },
);
SubscriptionSchema.index(
  { userId: 1, status: 1, expiresAt: 1 },
  { name: 'userId_1_status_1_expiresAt_1' },
);
SubscriptionSchema.index(
  { status: 1, nextPlanStartsAt: 1 },
  { name: 'status_1_nextPlanStartsAt_1' },
);
