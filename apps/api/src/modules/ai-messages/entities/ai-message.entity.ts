import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

export enum MessageFeedback {
  HELPFUL = 'helpful',
  NOT_HELPFUL = 'not_helpful',
  MISLEADING = 'misleading',
  INCOMPLETE = 'incomplete',
}

@Schema({ timestamps: true })
export class AiMessage extends Document {
  @ApiProperty({ description: 'Message ID' })
  id?: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  @ApiProperty({ description: 'Session ID' })
  sessionId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  @ApiProperty({ description: 'User ID' })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(MessageRole) })
  @ApiProperty({ description: 'Message role', enum: Object.values(MessageRole) })
  role: MessageRole;

  @Prop({ required: true })
  @ApiProperty({ description: 'Message content' })
  content: string;

  @Prop({ type: Object, default: {} })
  @ApiProperty({ description: 'Metadata (tokens, model, etc)', required: false })
  metadata?: Record<string, any>;

  @Prop({ type: Array, default: [] })
  @ApiProperty({ description: 'Array of attachments (file IDs, URLs)', type: [String] })
  attachments?: string[];

  @Prop()
  @ApiProperty({ description: 'Message feedback', enum: Object.values(MessageFeedback), required: false })
  feedback?: MessageFeedback;

  @Prop()
  @ApiProperty({ description: 'Feedback notes', required: false })
  feedbackNotes?: string;

  @Prop({ type: Object, default: {} })
  @ApiProperty({ description: 'Citation sources' })
  citations?: Record<string, any>;

  @Prop({ default: 0 })
  @ApiProperty({ description: 'Token count' })
  tokenCount: number;

  @Prop({ default: false })
  @ApiProperty({ description: 'Whether message was flagged as inappropriate' })
  isFlagged: boolean;

  @Prop()
  @ApiProperty({ description: 'Reason for flag', required: false })
  flagReason?: string;

  @Prop({ default: Date.now })
  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @Prop({ default: Date.now })
  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

export const AiMessageSchema = SchemaFactory.createForClass(AiMessage);

export type AiMessageDocument = AiMessage & Document;

// Create indexes
AiMessageSchema.index({ sessionId: 1, createdAt: -1 });
AiMessageSchema.index({ userId: 1, createdAt: -1 });
AiMessageSchema.index({ role: 1 });
AiMessageSchema.index({ isFlagged: 1 });
