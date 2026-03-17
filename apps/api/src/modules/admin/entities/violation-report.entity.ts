import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ViolationReportDocument = HydratedDocument<ViolationReport>;

export enum ViolationType {
  HARASSMENT = 'harassment',
  SPAM = 'spam',
  MISINFORMATION = 'misinformation',
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  IMPERSONATION = 'impersonation',
  FRAUD = 'fraud',
  AI_HALLUCINATION = 'ai_hallucination', // Khi AI nói bậy/sai kiến thức
}

export enum ViolationStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
}

@Schema({ timestamps: true })
export class ViolationReport {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  reporterId?: Types.ObjectId; // Người gửi báo cáo (có thể null nếu là hệ thống tự động)

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reportedUserId: Types.ObjectId; // Người bị báo cáo

  @Prop({ enum: ViolationType, required: true })
  type: ViolationType;

  @Prop({ required: true, maxlength: 1000 })
  reason: string;

  @Prop({ enum: ViolationStatus, default: ViolationStatus.PENDING })
  status: ViolationStatus;

  @Prop()
  evidence?: string; // URL hoặc mô tả bằng chứng

  @Prop([
    {
      note: { type: String, required: true },
      addedBy: { type: Types.ObjectId, ref: 'User', required: true },
      addedAt: { type: Date, default: Date.now },
    },
  ])
  notes: Array<{ note: string; addedBy: Types.ObjectId; addedAt: Date }>;

  @Prop()
  resolvedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  resolvedBy?: Types.ObjectId; // Admin đã xử lý

  @Prop()
  resolution?: string; // Quyết định: khóa tài khoản, cảnh báo,...
}

export const ViolationReportSchema = SchemaFactory.createForClass(
  ViolationReport,
);

// Indexes for better query performance
ViolationReportSchema.index({ reportedUserId: 1, status: 1 });
ViolationReportSchema.index({ status: 1, createdAt: -1 });
ViolationReportSchema.index({ type: 1 });
