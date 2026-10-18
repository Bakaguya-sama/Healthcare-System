import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConsultationUsageDocument = HydratedDocument<ConsultationUsage>;

export enum ConsultationUsageStatus {
  RESERVED = 'reserved',
  COUNTED = 'counted',
  RELEASED = 'released',
  EXPIRED = 'expired',
}

@Schema({ timestamps: true, collection: 'consultationusages' })
export class ConsultationUsage {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: true })
  subscriptionId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Consultation', required: true })
  consultationId!: Types.ObjectId;

  @Prop({ required: true }) cycleStart!: Date;
  @Prop({ required: true }) cycleEnd!: Date;
  @Prop({ required: true, min: 0 }) limitAtTime!: number;
  @Prop({ required: true, enum: ConsultationUsageStatus })
  status!: ConsultationUsageStatus;
  @Prop({ required: true, enum: ['plan'] }) source!: 'plan';
  @Prop({ required: true, unique: true }) uniqueRequestKey!: string;
  @Prop({ required: true }) reservedAt!: Date;
  @Prop() countedAt?: Date;
  @Prop() releasedAt?: Date;
  @Prop({ maxlength: 64 }) releaseReason?: string;
  @Prop() expiresAt?: Date;
}

export const ConsultationUsageSchema =
  SchemaFactory.createForClass(ConsultationUsage);
ConsultationUsageSchema.index(
  { uniqueRequestKey: 1 },
  { name: 'uniqueRequestKey_1', unique: true },
);
ConsultationUsageSchema.index(
  { consultationId: 1 },
  { name: 'consultationId_1', unique: true },
);
ConsultationUsageSchema.index(
  { userId: 1, cycleStart: 1, cycleEnd: 1, status: 1 },
  { name: 'userId_1_cycleStart_1_cycleEnd_1_status_1' },
);
ConsultationUsageSchema.index(
  { subscriptionId: 1, cycleStart: 1, status: 1 },
  { name: 'subscriptionId_1_cycleStart_1_status_1' },
);
ConsultationUsageSchema.index(
  { status: 1, expiresAt: 1 },
  { name: 'status_1_expiresAt_1' },
);
