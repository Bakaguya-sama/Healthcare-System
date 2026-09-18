import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

export enum SenderType {
  PATIENT = 'patient',
  DOCTOR = 'doctor',
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Consultation', required: true })
  consultationId: Types.ObjectId;

  /** @deprecated Kept only while old clients/data are being migrated. */
  @Prop({ type: Types.ObjectId, ref: 'Session', required: false, select: false })
  doctorSessionId?: Types.ObjectId;

  /** Client generated UUID/nonce used to make retries idempotent. */
  @Prop({ type: String, required: false, trim: true, maxlength: 128 })
  clientMessageId?: string;

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
MessageSchema.index(
  { consultationId: 1, sentAt: -1, _id: -1 },
  { name: 'consultationId_1_sentAt_-1__id_-1' },
);
MessageSchema.index(
  { consultationId: 1, clientMessageId: 1 },
  {
    name: 'consultationId_1_clientMessageId_1_unique',
    unique: true,
    partialFilterExpression: {
      consultationId: { $exists: true },
      clientMessageId: { $exists: true },
    },
  },
);
MessageSchema.index(
  { doctorSessionId: 1, sentAt: -1, _id: -1 },
  { name: 'doctorSessionId_1_sentAt_-1__id_-1' },
);
MessageSchema.index({ senderId: 1, sentAt: -1 });
MessageSchema.index({ sentAt: -1 });
