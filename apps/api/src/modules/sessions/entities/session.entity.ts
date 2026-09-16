import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SessionDocument = HydratedDocument<Session>;

export enum SessionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

@Schema({ timestamps: true })
export class Session {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  doctorId: Types.ObjectId;

  @Prop({ required: true })
  scheduledAt: Date;

  @Prop()
  startedAt?: Date;

  @Prop()
  endedAt?: Date;

  @Prop({ enum: SessionStatus, default: SessionStatus.PENDING })
  status: SessionStatus;

  @Prop()
  patientNotes?: string;

  @Prop()
  doctorNotes?: string;

  @Prop()
  lastMessageAt?: Date;

  @Prop()
  lastMessageId?: string;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Indexes for better query performance
SessionSchema.index(
  { patientId: 1, scheduledAt: -1, _id: -1 },
  { name: 'patientId_1_scheduledAt_-1__id_-1' },
);
SessionSchema.index(
  { patientId: 1, status: 1, scheduledAt: -1, _id: -1 },
  { name: 'patientId_1_status_1_scheduledAt_-1__id_-1' },
);
SessionSchema.index(
  { doctorId: 1, scheduledAt: -1, _id: -1 },
  { name: 'doctorId_1_scheduledAt_-1__id_-1' },
);
SessionSchema.index(
  { doctorId: 1, status: 1, scheduledAt: -1, _id: -1 },
  { name: 'doctorId_1_status_1_scheduledAt_-1__id_-1' },
);
SessionSchema.index({ status: 1, scheduledAt: -1 });
SessionSchema.index({ scheduledAt: 1 }); // For reminders/notifications
