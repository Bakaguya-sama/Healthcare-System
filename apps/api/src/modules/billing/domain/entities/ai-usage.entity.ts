import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AiUsageDailyDocument = HydratedDocument<AiUsageDaily>;
export type AiQuotaReservationDocument = HydratedDocument<AiQuotaReservation>;

@Schema({ timestamps: true, collection: 'aiusagedailies' })
export class AiUsageDaily {
  @Prop({ type: Types.ObjectId, required: true }) userId!: Types.ObjectId;
  /** UTC day for day plans, or subscription cycle start for cycle plans. */
  @Prop({ required: true }) periodStart!: Date;
  @Prop({ required: true, enum: ['day', 'subscription_cycle'] }) periodType!: string;
  @Prop({ required: true, default: 0, min: 0 }) chatRequestCount!: number;
  @Prop({ required: true, default: 0, min: 0 }) chatInputTokens!: number;
  @Prop({ required: true, default: 0, min: 0 }) chatOutputTokens!: number;
  @Prop({ required: true, default: 0, min: 0 }) chatTotalTokens!: number;
  @Prop({ required: true, default: 0, min: 0 }) reservedRequestCount!: number;
  @Prop({ required: true, default: 0, min: 0 }) reservedTokens!: number;
}
export const AiUsageDailySchema = SchemaFactory.createForClass(AiUsageDaily);
AiUsageDailySchema.index({ userId: 1, periodType: 1, periodStart: 1 }, { unique: true, name: 'userId_1_periodType_1_periodStart_1_unique' });

export enum AiQuotaReservationStatus {
  RESERVED = 'reserved',
  COMMITTED = 'committed',
  RELEASED = 'released',
  USAGE_RECONCILIATION_REQUIRED = 'usage_reconciliation_required',
}
@Schema({ timestamps: true, collection: 'aiquotareservations' })
export class AiQuotaReservation {
  @Prop({ type: Types.ObjectId, required: true }) userId!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true }) subscriptionId!: Types.ObjectId;
  @Prop({ required: true, enum: ['day', 'subscription_cycle'] }) periodType!: string;
  @Prop({ required: true }) periodStart!: Date;
  @Prop({ required: true }) idempotencyKey!: string;
  @Prop({ required: true, enum: AiQuotaReservationStatus }) status!: AiQuotaReservationStatus;
  @Prop({ required: true, min: 0 }) reservedTokens!: number;
  @Prop({ required: true, min: 0 }) estimatedInputTokens!: number;
  @Prop({ required: true, min: 0 }) maxOutputTokens!: number;
  @Prop() committedInputTokens?: number;
  @Prop() committedOutputTokens?: number;
  @Prop() releasedAt?: Date;
  /** Provider produced a response without usage metadata; operator reconciliation is required. */
  @Prop() usageReconciliationRequiredAt?: Date;
  @Prop() settlementFailureReason?: string;
}
export const AiQuotaReservationSchema = SchemaFactory.createForClass(AiQuotaReservation);
AiQuotaReservationSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, name: 'userId_1_idempotencyKey_1_unique' });
