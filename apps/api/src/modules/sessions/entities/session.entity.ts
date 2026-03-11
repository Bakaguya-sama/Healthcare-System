import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SessionDocument = HydratedDocument<Session>;

export enum SessionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

@Schema({ timestamps: true })
export class Session {
  @Prop({ type: Types.ObjectId, ref: 'UserEntity', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'UserEntity', required: true })
  doctorId: Types.ObjectId;

  @Prop({ required: true })
  scheduledAt: Date;

  @Prop({ required: true })
  duration: number; // minutes

  @Prop({ enum: SessionStatus, default: SessionStatus.PENDING })
  status: SessionStatus;

  @Prop()
  note?: string;

  @Prop()
  meetingUrl?: string;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
