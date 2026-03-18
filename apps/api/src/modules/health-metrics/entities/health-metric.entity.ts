import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type HealthMetricDocument = HydratedDocument<HealthMetric>;

export enum MetricType {
  BLOOD_PRESSURE = 'blood_pressure',
  HEART_RATE = 'heart_rate',
  BMI = 'bmi',
  WEIGHT = 'weight',
  HEIGHT = 'height',
  WATER_INTAKE = 'water_intake',
  ACTIVITY_LEVEL = 'activity_level',
}

@Schema({ timestamps: true })
export class HealthMetric {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ enum: MetricType, required: true })
  type: MetricType;

  // Linh hoạt: {systolic: 120, diastolic: 80} hoặc {amount: 250}
  @Prop({ type: Object, required: true })
  values: {
    value?: number; // Giá trị đơn lẻ
    systolic?: number; // Cho blood_pressure
    diastolic?: number; // Cho blood_pressure
    amount?: number; // Cho water_intake, activity_level
    [key: string]: any; // Linh hoạt cho các metric khác
  };

  @Prop({ required: true })
  unit: string; // e.g., 'mmHg', 'bpm', 'mg/dL', 'kg', '°C', '%', 'ml'

  @Prop({ type: Date, default: () => new Date() })
  recordedAt: Date;
}

export const HealthMetricSchema = SchemaFactory.createForClass(HealthMetric);

// Index for better query performance
HealthMetricSchema.index({ patientId: 1, recordedAt: -1 });
HealthMetricSchema.index({ patientId: 1, type: 1, recordedAt: -1 });
