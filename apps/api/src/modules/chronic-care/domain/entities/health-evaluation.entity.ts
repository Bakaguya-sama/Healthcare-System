import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type HealthEvaluationDocument = HydratedDocument<HealthEvaluation>;
export enum HealthEvaluationSeverity { NORMAL = 'normal', ATTENTION = 'attention', URGENT = 'urgent' }

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'healthevaluations' })
export class HealthEvaluation {
  @Prop({ type: Types.ObjectId, ref: 'PatientCareProgram', required: true }) patientCareProgramId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) patientId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CareTask' }) careTaskId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'HealthMetric', required: true }) healthMetricId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CareRule', required: true }) careRuleId: Types.ObjectId;
  @Prop({ required: true, enum: HealthEvaluationSeverity }) severity: HealthEvaluationSeverity;
  @Prop({ type: [String], required: true, default: [] }) reasonCodes: string[];
  @Prop({ type: MongooseSchema.Types.Mixed, required: true }) inputData: Record<string, unknown>;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true }) timeRange: Record<string, unknown>;
  @Prop({ required: true, unique: true }) uniqueKey: string;
  @Prop({ required: true }) evaluatedAt: Date;
  @Prop({ type: Types.ObjectId, ref: 'HealthEvaluation' }) replacesEvaluationId?: Types.ObjectId;
}

export const HealthEvaluationSchema = SchemaFactory.createForClass(HealthEvaluation);
HealthEvaluationSchema.index({ patientCareProgramId: 1, evaluatedAt: -1 }, { name: 'patientCareProgramId_1_evaluatedAt_-1' });
HealthEvaluationSchema.index({ patientId: 1, severity: 1, evaluatedAt: -1 }, { name: 'patientId_1_severity_1_evaluatedAt_-1' });
HealthEvaluationSchema.index({ careRuleId: 1, evaluatedAt: -1 }, { name: 'careRuleId_1_evaluatedAt_-1' });
