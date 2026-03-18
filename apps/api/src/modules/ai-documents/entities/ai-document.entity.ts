import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export enum DocumentStatus {
  PROCESSING = 'processing',
  ACTIVE = 'active',
  ERROR = 'error',
  INACTIVE = 'inactive',
}

export enum DocumentType {
  MEDICAL_GUIDELINE = 'medical_guideline',
  RESEARCH_PAPER = 'research_paper',
  FAQ = 'faq',
  PROCEDURE = 'procedure',
  TERMINOLOGY = 'terminology',
  GENERAL = 'general',
}

@Schema({ timestamps: true })
export class AiDocument extends Document {
  @ApiProperty({ description: 'Document ID' })
  declare _id: Types.ObjectId;

  @Prop({ required: true })
  @ApiProperty({ description: 'Document title' })
  title: string;

  @Prop()
  @ApiProperty({ description: 'Document description', required: false })
  description?: string;

  @Prop({ required: true })
  @ApiProperty({ description: 'Original file name' })
  fileName: string;

  @Prop({ required: true, enum: Object.values(DocumentType) })
  @ApiProperty({ description: 'Document type', enum: Object.values(DocumentType) })
  documentType: DocumentType;

  @Prop({ required: true })
  @ApiProperty({ description: 'S3/Cloud storage URL' })
  fileUrl: string;

  @Prop({ required: true })
  @ApiProperty({ description: 'File size in bytes' })
  fileSize: number;

  @Prop()
  @ApiProperty({ description: 'MIME type', example: 'application/pdf' })
  mimeType?: string;

  @Prop({ required: true, enum: Object.values(DocumentStatus), default: DocumentStatus.PROCESSING })
  @ApiProperty({ description: 'Document status', enum: Object.values(DocumentStatus) })
  status: DocumentStatus;

  @Prop({ required: true, type: Types.ObjectId })
  @ApiProperty({ description: 'Uploaded by admin ID' })
  uploadedBy: Types.ObjectId;

  @Prop({ type: Array, default: [] })
  @ApiProperty({ description: 'Array of tags for categorization', type: [String] })
  tags: string[];

  @Prop({ type: Array, default: [] })
  @ApiProperty({ description: 'Array of related document IDs', type: [String] })
  relatedDocuments: Types.ObjectId[];

  @Prop({ type: Object, default: {} })
  @ApiProperty({ description: 'Extracted metadata' })
  metadata: Record<string, any>;

  @Prop({ default: 0 })
  @ApiProperty({ description: 'Total chunks created from this document' })
  totalChunks: number;

  @Prop({ default: 0 })
  @ApiProperty({ description: 'Number of times this document was used in AI responses' })
  usageCount: number;

  @Prop()
  @ApiProperty({ description: 'When document was indexed for RAG', required: false })
  indexedAt?: Date;

  @Prop({ default: Date.now })
  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @Prop({ default: Date.now })
  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

export const AiDocumentSchema = SchemaFactory.createForClass(AiDocument);

export type AiDocumentDocument = AiDocument & Document;

// Create indexes
AiDocumentSchema.index({ title: 'text', description: 'text', tags: 1 });
AiDocumentSchema.index({ documentType: 1, status: 1 });
AiDocumentSchema.index({ uploadedBy: 1, createdAt: -1 });
AiDocumentSchema.index({ status: 1 });
