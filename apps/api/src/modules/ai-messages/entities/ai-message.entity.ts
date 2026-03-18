import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum SenderType {
  PATIENT = 'patient',
  AI = 'ai',
}

@Schema({ timestamps: true })
export class AiMessage extends Document {
  @Prop({ required: true, type: Types.ObjectId })
  aiSessionId: Types.ObjectId;

  @Prop({ enum: SenderType, required: true })
  senderType: SenderType;

  @Prop({ required: true })
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

export const AiMessageSchema = SchemaFactory.createForClass(AiMessage);

export type AiMessageDocument = AiMessage & Document;

// Create indexes
AiMessageSchema.index({ aiSessionId: 1, sentAt: -1 });
AiMessageSchema.index({ sentAt: -1 });
