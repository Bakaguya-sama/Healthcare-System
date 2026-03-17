import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type AiFeedbackDocument = AiFeedback & Document;

export enum FeedbackType {
  ACCURACY = 'accuracy',
  HELPFULNESS = 'helpfulness',
  CLARITY = 'clarity',
  RELEVANCE = 'relevance',
  COMPREHENSIVENESS = 'comprehensiveness',
  SAFETY = 'safety',
}

// Rating as number 1-5, not enum to avoid Mongoose casting issues

@Schema({ timestamps: true })
export class AiFeedback extends Document {
  @ApiProperty({ description: 'Feedback ID' })
  id?: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  @ApiProperty({ description: 'User ID' })
  userId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  @ApiProperty({ description: 'Session ID' })
  sessionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  @ApiProperty({ description: 'Message ID', required: false })
  messageId?: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(FeedbackType) })
  @ApiProperty({ description: 'Type of feedback', enum: Object.values(FeedbackType) })
  feedbackType: FeedbackType;

  @Prop({ required: true, min: 1, max: 5 })
  @ApiProperty({ description: 'Rating 1-5', example: 5 })
  rating: number;

  @Prop()
  @ApiProperty({ description: 'Feedback comment', required: false })
  comment?: string;

  @Prop({ type: Array, default: [] })
  @ApiProperty({ description: 'Tags for feedback' })
  tags: string[];

  @Prop({ type: Object, default: {} })
  @ApiProperty({ description: 'Additional metadata' })
  metadata?: Record<string, any>;

  @Prop({ default: 0 })
  @ApiProperty({ description: 'Number of times this feedback is marked helpful' })
  helpfulCount: number;

  @Prop({ default: false })
  @ApiProperty({ description: 'Whether feedback is verified by admin' })
  isVerified: boolean;

  @Prop({ default: Date.now })
  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @Prop({ default: Date.now })
  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

export const AiFeedbackSchema = SchemaFactory.createForClass(AiFeedback);

// Create indexes
AiFeedbackSchema.index({ userId: 1, createdAt: -1 });
AiFeedbackSchema.index({ sessionId: 1 });
AiFeedbackSchema.index({ messageId: 1 });
AiFeedbackSchema.index({ feedbackType: 1, rating: 1 });
AiFeedbackSchema.index({ isVerified: 1 });
