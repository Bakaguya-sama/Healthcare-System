import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { HealthEvaluationSeverity } from './health-evaluation.entity';

export type CareAlertDocument = HydratedDocument<CareAlert>;
export enum CareAlertStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'carealerts',
})
export class CareAlert {
  @Prop({ required: true, min: 1, default: 1 }) revision: number;
  @Prop({ type: Types.ObjectId, ref: 'PatientCareProgram', required: true })
  patientCareProgramId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'HealthEvaluation', required: true })
  evaluationId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  assignedDoctorId: Types.ObjectId;
  @Prop({ type: String, required: true, enum: HealthEvaluationSeverity })
  severity: HealthEvaluationSeverity;
  @Prop({
    type: String,
    required: true,
    enum: CareAlertStatus,
    default: CareAlertStatus.OPEN,
  })
  status: CareAlertStatus;
  @Prop({ type: [String], required: true, default: [] }) reasonCodes: string[];
  @Prop({ required: true }) uniqueKey: string;
  @Prop({ required: true }) detectedAt: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) acknowledgedBy?: Types.ObjectId;
  @Prop({ type: Date }) acknowledgedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) resolvedBy?: Types.ObjectId;
  @Prop({ type: Date }) resolvedAt?: Date;
  @Prop({ maxlength: 500 }) resolutionNote?: string;
  @Prop({ type: Types.ObjectId, ref: 'User' }) dismissedBy?: Types.ObjectId;
  @Prop({ type: Date }) dismissedAt?: Date;
  @Prop({ maxlength: 500 }) dismissalReason?: string;
}

export const CareAlertSchema = SchemaFactory.createForClass(CareAlert);
CareAlertSchema.index(
  { evaluationId: 1 },
  { name: 'evaluationId_1', unique: true },
);
CareAlertSchema.index({ uniqueKey: 1 }, { name: 'uniqueKey_1', unique: true });
CareAlertSchema.index(
  { assignedDoctorId: 1, status: 1, severity: 1, detectedAt: -1 },
  { name: 'assignedDoctorId_1_status_1_severity_1_detectedAt_-1' },
);
CareAlertSchema.index(
  { assignedDoctorId: 1, severity: -1, detectedAt: -1, _id: -1 },
  { name: 'assignedDoctorId_1_severity_-1_detectedAt_-1__id_-1' },
);
CareAlertSchema.index(
  { patientCareProgramId: 1, detectedAt: -1 },
  { name: 'patientCareProgramId_1_detectedAt_-1' },
);
