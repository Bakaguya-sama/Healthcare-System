import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum DocumentStatus {
  PENDING_INGESTION = 'pending_ingestion',
  PROCESSING = 'processing',
  READY_FOR_ACTIVATION = 'ready_for_activation',
  ACTIVE = 'active',
  ERROR = 'error',
  INACTIVE = 'inactive',
}

export enum DocumentReviewStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
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

  @Prop({ required: true })
  publicId: string;

  /** Immutable content identity for dedupe and audit; never returned to clients. */
  @Prop({ required: true, index: true })
  contentHash: string;

  @Prop({ required: true, default: 1 })
  documentVersion: number;

  @Prop({ type: Types.ObjectId, ref: 'AiDocument', default: null, index: true })
  parentDocumentId?: Types.ObjectId | null;

  @Prop({ required: true, default: 'vi' })
  knowledgeLanguage: string;

  @Prop({ required: true, default: 'general' })
  scope: string;

  @Prop({ required: true, default: 'internal' })
  source: string;

  @Prop({ default: 1 })
  ingestionVersion: number;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reviewedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  reviewedAt?: Date | null;

  @Prop({ type: String, default: null })
  reviewReason?: string | null;

  @Prop({
    required: true,
    enum: Object.values(DocumentStatus),
    default: DocumentStatus.PROCESSING,
  })
  status: DocumentStatus;

  @Prop({ required: true, type: Types.ObjectId })
  uploadedBy: Types.ObjectId;

  @Prop({ type: Date })
  validUntil?: Date;

  @Prop({
    type: String,
    enum: Object.values(DocumentReviewStatus),
    default: DocumentReviewStatus.PENDING_REVIEW,
  })
  reviewStatus: DocumentReviewStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  approvedAt?: Date;
}

export const AiDocumentSchema = SchemaFactory.createForClass(AiDocument);

export type AiDocumentDocument = AiDocument & Document;

// Create indexes
AiDocumentSchema.index({ title: 'text' });
AiDocumentSchema.index({ status: 1 });
AiDocumentSchema.index({ uploadedBy: 1, createdAt: -1 });
AiDocumentSchema.index({ reviewStatus: 1, validUntil: 1 });
AiDocumentSchema.index({ reviewStatus: 1, status: 1, scope: 1, knowledgeLanguage: 1 });
AiDocumentSchema.index({ parentDocumentId: 1, documentVersion: -1 });
