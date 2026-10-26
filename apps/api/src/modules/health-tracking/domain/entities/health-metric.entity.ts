import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type HealthMetricDocument = HydratedDocument<HealthMetric>;

export enum MetricType {
  BLOOD_PRESSURE = 'blood_pressure',
  HEART_RATE = 'heart_rate',
  BLOOD_GLUCOSE = 'blood_glucose',
  OXYGEN_SATURATION = 'oxygen_saturation',
  BODY_TEMPERATURE = 'body_temperature',
  RESPIRATORY_RATE = 'respiratory_rate',
  BMI = 'bmi',
  WEIGHT = 'weight',
  HEIGHT = 'height',
  WATER_INTAKE = 'water_intake',
  KCAL_INTAKE = 'kcal_intake',
}

export enum HealthMetricSource {
  MANUAL = 'manual',
  DEVICE = 'device',
  CLINICIAN = 'clinician',
  IMPORT = 'import',
}

export enum HealthMetricValidationStatus {
  VALID = 'valid',
  REJECTED = 'rejected',
  SUPERSEDED = 'superseded',
  VOIDED = 'voided',
}

@Schema({ _id: false })
export class HealthMetricMetadata {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: String, enum: MetricType, required: true })
  metricType: MetricType;

  @Prop({ required: true })
  unit: string;
}

const HealthMetricMetadataSchema =
  SchemaFactory.createForClass(HealthMetricMetadata);

@Schema({ _id: false })
export class HealthMetricSourceReference {
  @Prop({ maxlength: 120 }) deviceId?: string;
  @Prop({ maxlength: 120 }) importBatchId?: string;
  @Prop({ type: Types.ObjectId, ref: 'User' }) enteredBy?: Types.ObjectId;
}

const HealthMetricSourceReferenceSchema = SchemaFactory.createForClass(
  HealthMetricSourceReference,
);

@Schema({ timestamps: true, collection: 'healthmetrics' })
export class HealthMetric {
  @Prop({ type: HealthMetricMetadataSchema, required: true })
  meta: HealthMetricMetadata;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  values: Record<string, number>;

  @Prop({
    type: String,
    enum: HealthMetricSource,
    required: true,
    default: HealthMetricSource.MANUAL,
  })
  source: HealthMetricSource;

  @Prop({ type: HealthMetricSourceReferenceSchema })
  sourceRef?: HealthMetricSourceReference;

  @Prop({
    type: String,
    enum: HealthMetricValidationStatus,
    required: true,
    default: HealthMetricValidationStatus.VALID,
  })
  validationStatus: HealthMetricValidationStatus;

  @Prop({ type: [String], required: true, default: [] })
  validationReasonCodes: string[];

  @Prop({ maxlength: 64 }) recordedTimezone?: string;

  @Prop({ type: Types.ObjectId, ref: 'HealthMetric' })
  replacesMetricId?: Types.ObjectId;

  @Prop({ type: Date, required: true }) recordedAt: Date;
  @Prop({ type: Date, required: true, default: () => new Date() })
  ingestedAt: Date;
  @Prop({ type: Date }) voidedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) voidedBy?: Types.ObjectId;
  @Prop({ maxlength: 500 }) voidReason?: string;

  // Added by Mongoose timestamps; declared so projections stay type-safe.
  createdAt: Date;
  updatedAt: Date;
}

export const HealthMetricSchema = SchemaFactory.createForClass(HealthMetric);

HealthMetricSchema.index(
  { 'meta.patientId': 1, recordedAt: -1, _id: -1 },
  { name: 'meta.patientId_1_recordedAt_-1__id_-1' },
);
HealthMetricSchema.index(
  { 'meta.patientId': 1, 'meta.metricType': 1, recordedAt: -1, _id: -1 },
  { name: 'meta.patientId_1_meta.metricType_1_recordedAt_-1__id_-1' },
);
HealthMetricSchema.index(
  { replacesMetricId: 1 },
  { name: 'replacesMetricId_1', unique: true, sparse: true },
);
