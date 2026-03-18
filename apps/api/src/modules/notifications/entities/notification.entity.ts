import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationType {
  INFO = 'info', // Thông tin chung
  SUCCESS = 'success', // Thành công
  WARNING = 'warning', // Cảnh báo
  CRITICAL = 'critical', // Khẩn cấp
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

  @Prop({ default: false })
  isRead: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Indexes for better query performance
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
