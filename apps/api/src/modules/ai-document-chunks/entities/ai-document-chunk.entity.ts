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
  @ApiProperty({ description: 'Chunk index/sequence' })
  chunkIndex: number;

  @Prop({ required: true })
  @ApiProperty({ description: 'Chunk content/text' })
  content: string;

  @Prop()
  @ApiProperty({ description: 'Embedding vector (for vector search)', required: false })
  embedding?: number[];

  @Prop({ default: true })
  @ApiProperty({ description: 'Whether chunk is active' })
  isActive: boolean;
}

export const AiDocumentChunkSchema = SchemaFactory.createForClass(AiDocumentChunk);

export type AiDocumentChunkDocument = AiDocumentChunk & Document;

// Create indexes
AiDocumentChunkSchema.index({ documentId: 1, chunkIndex: 1 });
AiDocumentChunkSchema.index({ content: 'text' });
AiDocumentChunkSchema.index({ documentId: 1, usageCount: -1 });
