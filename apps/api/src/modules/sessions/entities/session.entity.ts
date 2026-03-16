import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SessionDocument = HydratedDocument<Session>;

export enum SessionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  RESCHEDULED = 'rescheduled',
}

export enum SessionType {
  CONSULTATION = 'consultation',
  FOLLOW_UP = 'follow_up',
  EMERGENCY = 'emergency',
  ROUTINE_CHECKUP = 'routine_checkup',
}

@Schema({ timestamps: true })
export class Session {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  doctorId: Types.ObjectId;

  @Prop({ enum: SessionType, default: SessionType.CONSULTATION })
  type: SessionType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  scheduledAt: Date;

  @Prop({ required: true, default: 30 })
  duration: number; // minutes

  @Prop()
  startedAt?: Date;

  @Prop()
  endedAt?: Date;

  @Prop({ enum: SessionStatus, default: SessionStatus.PENDING })
  status: SessionStatus;

  @Prop()
  note?: string;

  @Prop()
  meetingUrl?: string;

  @Prop()
  diagnosis?: string;

  @Prop()
  prescription?: string;

  @Prop([String])
  attachments?: string[]; // URLs of medical documents

  @Prop({ default: false })
  isReminderSent: boolean;

  @Prop()
  cancelReason?: string;

  @Prop()
  cancelledBy?: Types.ObjectId; // User who cancelled
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Indexes for better query performance
SessionSchema.index({ patientId: 1, scheduledAt: -1 });
SessionSchema.index({ doctorId: 1, scheduledAt: -1 });
SessionSchema.index({ status: 1, scheduledAt: -1 });
SessionSchema.index({ scheduledAt: 1 }); // For reminders/notifications
