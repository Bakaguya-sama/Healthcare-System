import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type HealthMetricDocument = HydratedDocument<HealthMetric>;

export enum MetricType {
  BLOOD_PRESSURE = 'blood_pressure',
  HEART_RATE = 'heart_rate',
  BMI = 'bmi',
  WEIGHT = 'weight',
  HEIGHT = 'height',
  WATER_INTAKE = 'water_intake',
  KCAL_INTAKE = 'kcal_intake',
}

export interface MetricValueDetail {
  value: number;
  recordedAt: Date;
}

@Schema({ timestamps: true })
export class HealthMetric {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ enum: MetricType, required: true })
  type: MetricType;

  // Linh hoat: { systolic: { value, recordedAt }, diastolic: { value, recordedAt } }
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  values: Record<string, MetricValueDetail>;

  @Prop({ required: true })
  unit: string; // e.g., 'mmHg', 'bpm', 'mg/dL', 'kg', '°C', '%', 'ml'

  @Prop({ type: Date, default: () => new Date() })
  recordedAt: Date;
}

export const HealthMetricSchema = SchemaFactory.createForClass(HealthMetric);

// Index for better query performance
HealthMetricSchema.index({ patientId: 1, recordedAt: -1 });
HealthMetricSchema.index({ patientId: 1, type: 1, recordedAt: -1 });
