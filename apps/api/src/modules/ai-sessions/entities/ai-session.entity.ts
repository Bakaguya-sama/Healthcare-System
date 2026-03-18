import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export enum SessionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

export enum SessionType {
  HEALTH_CONSULTATION = 'health_consultation',
  MENTAL_HEALTH = 'mental_health',
  MEDICATION_ADVICE = 'medication_advice',
  SYMPTOM_CHECK = 'symptom_check',
  GENERAL_INQUIRY = 'general_inquiry',
}

@Schema({ timestamps: true })
export class AiSession extends Document {
  @ApiProperty({ description: 'Session ID' })
  id?: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  @ApiProperty({ description: 'User ID' })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(SessionType) })
  @ApiProperty({ description: 'Type of session', enum: Object.values(SessionType) })
  sessionType: SessionType;

  @Prop({ required: true, enum: Object.values(SessionStatus), default: SessionStatus.ACTIVE })
  @ApiProperty({ description: 'Session status', enum: Object.values(SessionStatus) })
  status: SessionStatus;

  @Prop({ required: true })
  @ApiProperty({ description: 'Session title' })
  title: string;

  @Prop()
  @ApiProperty({ description: 'Session description', required: false })
  description?: string;

  @Prop({ type: Array, default: [] })
  @ApiProperty({ description: 'Array of message IDs', type: [String] })
  messageIds: Types.ObjectId[];

  @Prop()
  @ApiProperty({ description: 'Initial problem statement' })
  initialProblem: string;

  @Prop()
  @ApiProperty({ description: 'Summary of session', required: false })
  summary?: string;

  @Prop({ type: Object, default: {} })
  @ApiProperty({ description: 'Key findings from session' })
  keyFindings: Record<string, any>;

  @Prop({ type: Object, default: {} })
  @ApiProperty({ description: 'Recommendations' })
  recommendations: Record<string, any>;

  @Prop({ default: 0 })
  @ApiProperty({ description: 'Total messages in session' })
  totalMessages: number;

  @Prop({ default: 0 })
  @ApiProperty({ description: 'Total tokens used' })
  totalTokens: number;

  @Prop()
  @ApiProperty({ description: 'When session was completed', required: false })
  completedAt?: Date;

  @Prop({ default: Date.now })
  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @Prop({ default: Date.now })
  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

export const AiSessionSchema = SchemaFactory.createForClass(AiSession);

export type AiSessionDocument = AiSession & Document;

// Create indexes
AiSessionSchema.index({ userId: 1, status: 1 });
AiSessionSchema.index({ userId: 1, createdAt: -1 });
AiSessionSchema.index({ status: 1, createdAt: -1 });
AiSessionSchema.index({ sessionType: 1 });
