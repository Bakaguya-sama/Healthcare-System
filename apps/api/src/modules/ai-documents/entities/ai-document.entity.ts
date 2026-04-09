import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum DocumentStatus {
  PROCESSING = 'processing',
  ACTIVE = 'active',
  ERROR = 'error',
  INACTIVE = 'inactive',
}

@Schema({ timestamps: true })
export class AiDocument extends Document {
  declare _id: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  fileUrl: string;

  @Prop({ required: true })
  fileType: string;

  @Prop({required: true})
  publicId: string;

  @Prop({ required: true, enum: Object.values(DocumentStatus), default: DocumentStatus.PROCESSING })
  status: DocumentStatus;

  @Prop({ required: true, type: Types.ObjectId })
  uploadedBy: Types.ObjectId;
}

export const AiDocumentSchema = SchemaFactory.createForClass(AiDocument);

export type AiDocumentDocument = AiDocument & Document;

// Create indexes
AiDocumentSchema.index({ title: 'text' });
AiDocumentSchema.index({ status: 1 });
AiDocumentSchema.index({ uploadedBy: 1, createdAt: -1 });
