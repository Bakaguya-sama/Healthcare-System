import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ReportType {
  HARASSMENT = 'harassment',
  SPAM = 'spam',
  MISINFORMATION = 'misinformation',
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  IMPERSONATION = 'impersonation',
  FRAUD = 'fraud',
  AI_HALLUCINATION = 'ai_hallucination',
  OTHER = 'other',
}

export enum ViolationStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
}

@Schema({ timestamps: true })
export class Violation extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reporterId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reportedUserId: Types.ObjectId | null;

  @Prop({ type: String, enum: ReportType, required: true })
  reportType: ReportType;

  @Prop({ required: true, maxlength: 1000 })
  reason: string;

  @Prop({
    type: String,
    enum: ViolationStatus,
    default: ViolationStatus.PENDING,
  })
  status: ViolationStatus;
}

export const ViolationSchema = SchemaFactory.createForClass(Violation);
