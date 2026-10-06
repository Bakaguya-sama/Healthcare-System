import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type CareReportDocument = HydratedDocument<CareReport>;

export enum CareReportType {
  WEEKLY = 'weekly',
  THIRTY_DAY = 'thirty_day',
}

export enum CareReportStatus {
  READY = 'ready',
  SUPERSEDED = 'superseded',
  INVALIDATED = 'invalidated',
}

@Schema({ timestamps: true, collection: 'carereports' })
export class CareReport {
  @Prop({ type: Types.ObjectId, ref: 'PatientCareProgram', required: true })
  patientCareProgramId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CareRule', required: true })
  careRuleId: Types.ObjectId;
  @Prop({ required: true, enum: CareReportType }) reportType: CareReportType;
  @Prop({ required: true, default: 'v1' }) dataFormatVersion: string;
  @Prop({ required: true }) windowStart: Date;
  @Prop({ required: true }) windowEnd: Date;
  @Prop({ required: true, maxlength: 64 }) timezone: string;
  @Prop({ required: true }) dataUntil: Date;
  @Prop({
    required: true,
    enum: CareReportStatus,
    default: CareReportStatus.READY,
  })
  status: CareReportStatus;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  statistics: Record<string, unknown>;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true }) trends: Record<
    string,
    unknown
  >;
  @Prop({ type: [MongooseSchema.Types.Mixed], required: true, default: [] })
  missingData: unknown[];
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  healthEvaluationSummary: Record<string, unknown>;
  @Prop({ type: MongooseSchema.Types.Mixed }) consultationSummary?: Record<
    string,
    unknown
  >;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  sourceData: Record<string, unknown>;
  @Prop({ required: true, maxlength: 64 }) inputHash: string;
  @Prop({ required: true, min: 1 }) reportVersion: number;
  @Prop({ type: Types.ObjectId, ref: 'CareReport' })
  replacesReportId?: Types.ObjectId;
  @Prop({ required: true }) generatedAt: Date;
}

export const CareReportSchema = SchemaFactory.createForClass(CareReport);
CareReportSchema.index(
  {
    patientCareProgramId: 1,
    reportType: 1,
    windowStart: 1,
    windowEnd: 1,
    reportVersion: 1,
  },
  {
    name: 'enrollment_1_type_1_windowStart_1_windowEnd_1_version_1',
    unique: true,
  },
);
CareReportSchema.index(
  { patientId: 1, generatedAt: -1, _id: -1 },
  { name: 'patientId_1_generatedAt_-1__id_-1' },
);
CareReportSchema.index({ inputHash: 1 }, { name: 'inputHash_1' });
