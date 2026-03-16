import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  VOICE = 'voice',
  VIDEO = 'video',
}

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  receiverId: Types.ObjectId;

  @Prop({ required: true, minlength: 1, maxlength: 5000 })
  content: string;

  @Prop({ enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Prop({ enum: MessageStatus, default: MessageStatus.SENT })
  status: MessageStatus;

  @Prop({ required: false })
  fileUrl?: string;

  @Prop({ required: false })
  fileName?: string;

  @Prop({ required: false })
  fileSize?: number;

  @Prop({ required: false })
  mimeType?: string;

  @Prop({ type: [Types.ObjectId], default: [] })
  attachmentIds?: Types.ObjectId[];

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ required: false })
  readAt?: Date;

  @Prop({ default: false })
  isEdited: boolean;

  @Prop({ required: false })
  editedAt?: Date;

  @Prop({ required: false })
  editHistory?: Array<{
    content: string;
    editedAt: Date;
  }>;

  @Prop({ required: false, type: Types.ObjectId })
  replyToId?: Types.ObjectId;

  @Prop({ required: false })
  replyContent?: string;

  @Prop({ default: 0 })
  reactionCount: number;

  @Prop({ type: [String], default: [] })
  reactions?: string[];

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ required: false })
  deletedAt?: Date;

  @Prop({ default: false })
  isPinned: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Add indexes for performance
MessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });
MessageSchema.index({ receiverId: 1, createdAt: -1 });
MessageSchema.index({ status: 1 });
MessageSchema.index({ isRead: 1 });
MessageSchema.index({ createdAt: -1 });
