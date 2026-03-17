import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export enum InsightType {
  TREND = 'trend',
  ANOMALY = 'anomaly',
  PREDICTION = 'prediction',
  RECOMMENDATION = 'recommendation',
  ALERT = 'alert',
  CORRELATION = 'correlation',
}

export enum ConfidenceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

@Schema({ timestamps: true })
export class AiHealthInsight extends Document {
  @ApiProperty({ description: 'Insight ID' })
  declare _id: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  @ApiProperty({ description: 'Patient/User ID' })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(InsightType) })
  @ApiProperty({ description: 'Type of insight', enum: Object.values(InsightType) })
  insightType: InsightType;

  @Prop({ required: true })
  @ApiProperty({ description: 'Metric being analyzed (heart_rate, blood_pressure, etc)' })
  metricType: string;

  @Prop({ required: true })
  @ApiProperty({ description: 'Title/summary of insight' })
  title: string;

  @Prop({ required: true })
  @ApiProperty({ description: 'Detailed description' })
  description: string;

  @Prop({ type: Object, required: true })
  @ApiProperty({ description: 'Analysis data' })
  analysisData: Record<string, any>;

  @Prop({ required: true, enum: Object.values(ConfidenceLevel) })
  @ApiProperty({ description: 'Confidence level', enum: Object.values(ConfidenceLevel) })
  confidenceLevel: ConfidenceLevel;

  @Prop()
  @ApiProperty({ description: 'Recommended action', required: false })
  recommendedAction?: string;

  @Prop({ type: Array, default: [] })
  @ApiProperty({ description: 'Related metric IDs', type: [String] })
  relatedMetrics: Types.ObjectId[];

  @Prop({ type: Array, default: [] })
  @ApiProperty({ description: 'Related health condition keywords', type: [String] })
  healthConditions: string[];

  @Prop()
  @ApiProperty({ description: 'When insight period started' })
  periodStart: Date;

  @Prop()
  @ApiProperty({ description: 'When insight period ended' })
  periodEnd: Date;

  @Prop({ default: false })
  @ApiProperty({ description: 'Whether user was notified' })
  notified: boolean;

  @Prop({ default: false })
  @ApiProperty({ description: 'Whether user acknowledged this insight' })
  acknowledged: boolean;

  @Prop()
  @ApiProperty({ description: 'When user acknowledged', required: false })
  acknowledgedAt?: Date;

  @Prop({ type: Object, default: {} })
  @ApiProperty({ description: 'Additional metadata' })
  metadata: Record<string, any>;

  @Prop({ default: Date.now })
  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @Prop({ default: Date.now })
  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

export const AiHealthInsightSchema = SchemaFactory.createForClass(AiHealthInsight);

export type AiHealthInsightDocument = AiHealthInsight & Document;

// Create indexes
AiHealthInsightSchema.index({ userId: 1, insightType: 1, createdAt: -1 });
AiHealthInsightSchema.index({ userId: 1, notified: 1 });
AiHealthInsightSchema.index({ metricType: 1, confidenceLevel: 1 });
AiHealthInsightSchema.index({ insightType: 1, createdAt: -1 });
