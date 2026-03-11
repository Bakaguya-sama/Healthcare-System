import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type HealthMetricDocument = HydratedDocument<HealthMetric>;

@Schema({ timestamps: true })
export class HealthMetric {
  @Prop({ type: Types.ObjectId, ref: 'UserEntity', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  type: string; // e.g., 'blood_pressure', 'heart_rate', 'blood_sugar', 'weight', 'bmi'

  @Prop({ required: true })
  value: number;

  @Prop()
  unit: string; // e.g., 'mmHg', 'bpm', 'mg/dL', 'kg'

  @Prop()
  note?: string;

  @Prop()
  recordedAt: Date;
}

export const HealthMetricSchema = SchemaFactory.createForClass(HealthMetric);
