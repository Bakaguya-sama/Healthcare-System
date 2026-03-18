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

export enum RiskLevel {
  NORMAL = 'normal',
  WARNING = 'warning',
  DANGER = 'danger',
}

@Schema({ timestamps: true })
export class AiHealthInsight extends Document {
  @ApiProperty({ description: 'Insight ID' })
  declare _id: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  @ApiProperty({ description: 'Patient ID' })
  patientId: Types.ObjectId;

  @Prop({ type: Object, required: true })
  @ApiProperty({ description: 'Analyzed metrics data' })
  analyzedMetrics: Record<string, any>;

  @Prop({ required: true, enum: Object.values(RiskLevel) })
  @ApiProperty({ description: 'Risk level', enum: Object.values(RiskLevel) })
  riskLevel: RiskLevel;

  @Prop({ required: true })
  @ApiProperty({ description: 'Advice from AI' })
  advice: string;

  @Prop({ default: Date.now })
  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;
}

export const AiHealthInsightSchema = SchemaFactory.createForClass(AiHealthInsight);

export type AiHealthInsightDocument = AiHealthInsight & Document;

// Create indexes
AiHealthInsightSchema.index({ userId: 1, insightType: 1, createdAt: -1 });
AiHealthInsightSchema.index({ userId: 1, notified: 1 });
AiHealthInsightSchema.index({ metricType: 1, confidenceLevel: 1 });
AiHealthInsightSchema.index({ insightType: 1, createdAt: -1 });
