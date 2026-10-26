import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type CareSummaryDocument = HydratedDocument<CareSummary>;
export enum CareSummaryStatus {
  GENERATED = 'generated',
  FALLBACK = 'fallback',
  FAILED = 'failed',
}

@Schema({ timestamps: true, collection: 'caresummaries' })
export class CareSummary {
  @Prop({ type: Types.ObjectId, ref: 'CareReport', required: true })
  reportId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'PatientCareProgram', required: true })
  patientCareProgramId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CareRule', required: true })
  careRuleId: Types.ObjectId;
  @Prop({ required: true, enum: ['patient', 'doctor'] }) audience:
    | 'patient'
    | 'doctor';
  @Prop({ required: true, enum: CareSummaryStatus }) status: CareSummaryStatus;
  @Prop({ required: true, min: 1 }) summaryVersion: number;
  @Prop({ required: true, unique: true }) uniqueKey: string;
  @Prop({ type: MongooseSchema.Types.Mixed }) content?: Record<string, unknown>;
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  citations: unknown[];
  @Prop() provider?: string;
  @Prop() model?: string;
  @Prop({ required: true }) promptVersion: string;
  @Prop({ required: true }) ruleVersion: number;
  @Prop({ required: true }) inputHash: string;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  validation: Record<string, unknown>;
  @Prop() inputTokens?: number;
  @Prop() outputTokens?: number;
  @Prop() latencyMs?: number;
  @Prop() errorCode?: string;
}
export const CareSummarySchema = SchemaFactory.createForClass(CareSummary);
CareSummarySchema.index(
  { reportId: 1, audience: 1, summaryVersion: 1 },
  { unique: true, name: 'reportId_1_audience_1_summaryVersion_1' },
);
CareSummarySchema.index(
  { patientCareProgramId: 1, createdAt: -1 },
  { name: 'patientCareProgramId_1_createdAt_-1' },
);
CareSummarySchema.index(
  { status: 1, createdAt: -1 },
  { name: 'status_1_createdAt_-1' },
);
