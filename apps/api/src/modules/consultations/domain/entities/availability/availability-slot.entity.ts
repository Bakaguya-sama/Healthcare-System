import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AvailabilitySlotDocument = HydratedDocument<AvailabilitySlot>;

export enum AvailabilitySlotStatus {
  AVAILABLE = 'available',
  BOOKED = 'booked',
  BLOCKED = 'blocked',
  EXPIRED = 'expired',
}

@Schema({ timestamps: true, collection: 'availabilityslots' })
export class AvailabilitySlot {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  doctorId!: Types.ObjectId;

  /** Stored as a MongoDB UTC instant. `timezone` is display/policy metadata. */
  @Prop({ required: true }) startAt!: Date;

  @Prop({ required: true }) endAt!: Date;

  @Prop({ required: true, maxlength: 64 }) timezone!: string;

  @Prop({
    required: true,
    enum: AvailabilitySlotStatus,
    default: AvailabilitySlotStatus.AVAILABLE,
  })
  status!: AvailabilitySlotStatus;

  @Prop() blockedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) blockedBy?: Types.ObjectId;
  @Prop({ maxlength: 500 }) blockReason?: string;
}

export const AvailabilitySlotSchema =
  SchemaFactory.createForClass(AvailabilitySlot);
AvailabilitySlotSchema.index(
  { doctorId: 1, startAt: 1 },
  { name: 'doctorId_1_startAt_1', unique: true },
);
AvailabilitySlotSchema.index(
  { doctorId: 1, status: 1, startAt: 1, _id: 1 },
  { name: 'doctorId_1_status_1_startAt_1__id_1' },
);

/**
 * A per-doctor write fence. Updating this record inside the slot transaction
 * turns overlap checks into a serialized operation and prevents write skew.
 */
@Schema({ timestamps: true, collection: 'availabilityslotlocks' })
export class AvailabilitySlotLock {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  doctorId!: Types.ObjectId;

  @Prop({ required: true, min: 0, default: 0 }) revision!: number;
}

export const AvailabilitySlotLockSchema =
  SchemaFactory.createForClass(AvailabilitySlotLock);
AvailabilitySlotLockSchema.index(
  { doctorId: 1 },
  { name: 'doctorId_1', unique: true },
);
