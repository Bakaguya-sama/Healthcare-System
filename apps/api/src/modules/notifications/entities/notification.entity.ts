import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationType {
  HEALTH_ALERT = 'health_alert', // Cảnh báo chỉ số sức khỏe
  SESSION_REMINDER = 'session_reminder', // Nhắc nhở buổi tư vấn
  DOCTOR_MESSAGE = 'doctor_message', // Tin nhắn từ bác sĩ
  AI_INSIGHT = 'ai_insight', // Phân tích từ AI
  SYSTEM = 'system', // Thông báo hệ thống
  REVIEW_REQUEST = 'review_request', // Yêu cầu đánh giá
  ACCOUNT = 'account', // Thay đổi tài khoản
}

export enum NotificationStatus {
  NEW = 'new',
  READ = 'read',
  ARCHIVED = 'archived',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId; // Người nhận thông báo

  @Prop({
    enum: NotificationType,
    required: true,
  })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true, maxlength: 1000 })
  message: string;

  @Prop({
    enum: NotificationStatus,
    default: NotificationStatus.NEW,
  })
  status: NotificationStatus;

  @Prop({ required: false })
  relatedId?: Types.ObjectId; // Link đến resource liên quan (Session, Review, etc.)

  @Prop({ required: false })
  relatedType?: string; // Loại resource: 'session', 'review', 'health_metric'

  @Prop({ type: Object, default: {} })
  data?: Record<string, any>; // JSON data linh hoạt

  @Prop({ default: false })
  read: boolean;

  @Prop()
  readAt?: Date;

  @Prop({ required: false })
  expiresAt?: Date; // Thời điểm hết hạn thông báo

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Indexes for better query performance
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, status: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
