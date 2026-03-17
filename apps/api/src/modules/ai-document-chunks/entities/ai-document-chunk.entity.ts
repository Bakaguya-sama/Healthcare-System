import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ timestamps: true })
export class AiDocumentChunk extends Document {
  @ApiProperty({ description: 'Chunk ID' })
  declare _id: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  @ApiProperty({ description: 'Original document ID' })
  documentId: Types.ObjectId;

  @Prop({ required: true })
  @ApiProperty({ description: 'Chunk content/text' })
  content: string;

  @Prop({ required: true })
  @ApiProperty({ description: 'Chunk index/sequence' })
  chunkIndex: number;

  @Prop()
  @ApiProperty({ description: 'Embedding vector (for vector search)', required: false })
  embedding?: number[];

  @Prop({ default: 0 })
  @ApiProperty({ description: 'Character count' })
  charCount: number;

  @Prop({ default: 0 })
  @ApiProperty({ description: 'Token count estimate' })
  tokenCount: number;

  @Prop({ type: Object, default: {} })
  @ApiProperty({ description: 'Metadata (page num, section, etc)' })
  metadata: Record<string, any>;

  @Prop({ default: 0 })
  @ApiProperty({ description: 'Number of times this chunk was used' })
  usageCount: number;

  @Prop({ type: Array, default: [] })
  @ApiProperty({ description: 'Related chunk IDs', type: [String] })
  relatedChunks: Types.ObjectId[];

  @Prop({ default: Date.now })
  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @Prop({ default: Date.now })
  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

export const AiDocumentChunkSchema = SchemaFactory.createForClass(AiDocumentChunk);

export type AiDocumentChunkDocument = AiDocumentChunk & Document;

// Create indexes
AiDocumentChunkSchema.index({ documentId: 1, chunkIndex: 1 });
AiDocumentChunkSchema.index({ content: 'text' });
AiDocumentChunkSchema.index({ documentId: 1, usageCount: -1 });
