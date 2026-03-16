import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type HealthMetricDocument = HydratedDocument<HealthMetric>;

export enum MetricType {
  BLOOD_PRESSURE = 'blood_pressure',
  HEART_RATE = 'heart_rate',
  BLOOD_SUGAR = 'blood_sugar',
  WEIGHT = 'weight',
  TEMPERATURE = 'temperature',
  BMI = 'bmi',
  CHOLESTEROL = 'cholesterol',
  OXYGEN_LEVEL = 'oxygen_level',
}

export enum MetricStatus {
  NORMAL = 'normal',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

@Schema({ timestamps: true })
export class HealthMetric {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ enum: MetricType, required: true })
  type: MetricType;

  @Prop({ required: true })
  value: number;

  @Prop()
  systolic?: number; // For blood pressure

  @Prop()
  diastolic?: number; // For blood pressure

  @Prop({ required: true })
  unit: string; // e.g., 'mmHg', 'bpm', 'mg/dL', 'kg', '°C', '%'

  @Prop({ enum: MetricStatus, default: MetricStatus.NORMAL })
  status: MetricStatus;

  @Prop()
  note?: string;

  @Prop({ type: Date, default: () => new Date() })
  recordedAt: Date;

  @Prop({ default: false })
  isAlert: boolean;

  @Prop()
  doctor?: string; // Doctor notes
}

export const HealthMetricSchema = SchemaFactory.createForClass(HealthMetric);

// Index for better query performance
HealthMetricSchema.index({ userId: 1, recordedAt: -1 });
HealthMetricSchema.index({ userId: 1, type: 1, recordedAt: -1 });
