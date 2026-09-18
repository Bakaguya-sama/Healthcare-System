import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum OutboxStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DELIVERED = 'delivered',
  DEAD = 'dead',
}

@Schema({ timestamps: true, collection: 'outboxevents' })
export class OutboxEvent {
  @Prop({ type: String, required: true }) eventType: string;
  @Prop({ type: String, required: true }) aggregateType: string;
  @Prop({ type: Types.ObjectId, required: true }) aggregateId: Types.ObjectId;
  @Prop({ type: Object, required: true }) payload: Record<string, unknown>;
  @Prop({ type: String, required: true, unique: true }) idempotencyKey: string;
  @Prop({
    type: String,
    enum: Object.values(OutboxStatus),
    default: OutboxStatus.PENDING,
  })
  status: OutboxStatus;
  @Prop({ type: Number, default: 0, min: 0 }) attemptCount: number;
  @Prop({ type: Number, default: 8, min: 1, max: 20 }) maxAttempts: number;
  @Prop({ type: Date, default: () => new Date() }) nextAttemptAt: Date;
  @Prop({ type: Date }) lockedAt?: Date;
  @Prop({ type: Date }) lockExpiresAt?: Date;
  @Prop({ type: Date }) deliveredAt?: Date;
  @Prop({ type: String, maxlength: 1000 }) lastError?: string;
}
export type OutboxEventDocument = HydratedDocument<OutboxEvent>;
export const OutboxEventSchema = SchemaFactory.createForClass(OutboxEvent);
OutboxEventSchema.index(
  { status: 1, nextAttemptAt: 1, lockedAt: 1, _id: 1 },
  { name: 'status_1_nextAttemptAt_1_lockedAt_1__id_1' },
);
OutboxEventSchema.index(
  { status: 1, lockExpiresAt: 1, _id: 1 },
  { name: 'status_1_lockExpiresAt_1__id_1' },
);
