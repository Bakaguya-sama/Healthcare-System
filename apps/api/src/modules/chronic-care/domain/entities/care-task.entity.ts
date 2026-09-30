import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type CareTaskDocument = HydratedDocument<CareTask>;

export enum CareTaskStatus {
  SCHEDULED = 'scheduled',
  DUE = 'due',
  COMPLETED = 'completed',
  MISSED = 'missed',
  CANCELLED = 'cancelled',
}

export enum CareTaskType {
  METRIC = 'metric',
  CHECK_IN = 'check_in',
  EDUCATION = 'education',
  APPOINTMENT = 'appointment',
  DOCTOR_REVIEW = 'doctor_review',
}

@Schema({ timestamps: true, collection: 'caretasks' })
export class CareTask {
  @Prop({ type: Types.ObjectId, ref: 'PatientCareProgram', required: true })
  patientCareProgramId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' }) doctorId?: Types.ObjectId;
  @Prop({ required: true, maxlength: 64 }) templateKey: string;
  @Prop({ required: true, enum: CareTaskType }) taskType: CareTaskType;
  @Prop({ required: true, enum: CareTaskStatus }) status: CareTaskStatus;
  @Prop({ required: true, default: true }) required: boolean;
  @Prop({ required: true, maxlength: 32 }) scheduleVersion: string;
  @Prop({ required: true }) scheduledFor: Date;
  @Prop({ required: true }) windowStart: Date;
  @Prop({ required: true }) windowEnd: Date;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  completionRule: Record<string, unknown>;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  reminderPolicy: Record<string, unknown>;
  @Prop({ maxlength: 32 }) completionSourceType?: string;
  @Prop({ type: Types.ObjectId }) completionSourceId?: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.Mixed }) response?: Record<
    string,
    unknown
  >;
  @Prop() completedAt?: Date;
  @Prop() missedAt?: Date;
  @Prop() cancelledAt?: Date;
  @Prop({ maxlength: 500 }) cancellationReason?: string;
  @Prop({ required: true, unique: true, maxlength: 240 }) uniqueKey: string;
}

export const CareTaskSchema = SchemaFactory.createForClass(CareTask);
CareTaskSchema.index({ uniqueKey: 1 }, { name: 'uniqueKey_1', unique: true });
CareTaskSchema.index(
  { patientId: 1, status: 1, scheduledFor: 1 },
  { name: 'patientId_1_status_1_scheduledFor_1' },
);
CareTaskSchema.index(
  { patientCareProgramId: 1, status: 1, windowStart: 1 },
  { name: 'patientCareProgramId_1_status_1_windowStart_1' },
);
CareTaskSchema.index(
  { doctorId: 1, taskType: 1, status: 1, scheduledFor: 1 },
  { name: 'doctorId_1_taskType_1_status_1_scheduledFor_1' },
);
CareTaskSchema.index(
  { completionSourceType: 1, completionSourceId: 1 },
  { name: 'completionSourceType_1_completionSourceId_1', sparse: true },
);
