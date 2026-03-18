import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

export enum SenderType {
  PATIENT = 'patient',
  DOCTOR = 'doctor',
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Session', required: true })
  doctorSessionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ enum: SenderType, required: true })
  senderType: SenderType;

  @Prop({ required: true, minlength: 1, maxlength: 5000 })
  content: string;

  @Prop({
    type: [
      {
        fileUrl: String,
        fileName: String,
        fileSize: Number,
        mimeType: String,
      },
    ],
    default: [],
  })
  attachments?: Array<{
    fileUrl: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
  }>;

  @Prop({ type: Date, default: () => new Date() })
  sentAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Add indexes for performance
MessageSchema.index({ doctorSessionId: 1, sentAt: -1 });
MessageSchema.index({ senderId: 1, sentAt: -1 });
MessageSchema.index({ sentAt: -1 });
