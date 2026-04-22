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
  patientNotes?: string; // Tiêu đề, ghi chú của bệnh nhân khi bắt đầu buổi tư vấn

  @Prop()
  doctorNotes?: string; // Lời khuyên y tế của bác sĩ khi kết thúc tư vấn
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Indexes for better query performance
SessionSchema.index({ patientId: 1, scheduledAt: -1 });
SessionSchema.index({ doctorId: 1, scheduledAt: -1 });
SessionSchema.index({ status: 1, scheduledAt: -1 });
SessionSchema.index({ scheduledAt: 1 }); // For reminders/notifications
