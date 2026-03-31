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

  @Prop({ type: Date })
  readAt?: Date; // Thời điểm đánh dấu là read

  // ✅ NEW: Hỗ trợ file attachments (images, documents)
  @Prop({ type: Array, default: [] })
  attachments?: Array<{
    url: string; // Cloudinary URL
    publicId: string; // Để delete later
    fileName: string;
    fileType: 'image' | 'document';
    size: number;
    uploadedAt: Date;
  }>;

  // ✅ NEW: Metadata cho notification (tùy chọn)
  @Prop({ type: Object })
  metadata?: {
    relatedEntityId?: string; // VD: sessionId, documentId
    relatedEntityType?: string; // VD: 'session', 'document'
    action?: string; // VD: 'view', 'download'
  };

  @Prop({ type: Date })
  expiresAt?: Date; // Notification tự xóa sau khoảng thời gian
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Indexes for better query performance
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
