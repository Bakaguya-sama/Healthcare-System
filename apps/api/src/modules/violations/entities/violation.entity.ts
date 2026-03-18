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
}

export enum ViolationStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
}

@Schema({ timestamps: true })
export class Violation extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reporter_id: Types.ObjectId | null; // Người gửi báo cáo (Null nếu AI tự phát hiện)

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reported_user_id: Types.ObjectId | null; // Người bị báo cáo (Null nếu đối tượng là AI)

  @Prop({ type: String, enum: ReportType, required: true })
  report_type: ReportType;

  @Prop({ required: true, maxlength: 1000 })
  reason: string;

  @Prop({ type: String, enum: ViolationStatus, default: ViolationStatus.PENDING })
  status: ViolationStatus;

  @Prop({ type: String, default: null })
  resolution_note: string | null; // Ghi chú giải quyết

  @Prop({ type: Date, default: null })
  resolved_at: Date | null;

  @Prop({ type: Date, default: () => new Date() })
  created_at: Date;

  @Prop({ type: Date, default: () => new Date() })
  updated_at: Date;
}

export const ViolationSchema = SchemaFactory.createForClass(Violation);
