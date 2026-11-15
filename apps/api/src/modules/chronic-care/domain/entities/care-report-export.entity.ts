import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CareReportExportDocument = HydratedDocument<CareReportExport>;

export enum CareReportExportFormat {
  PDF = 'pdf',
  CSV = 'csv',
}

export enum CareReportExportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

@Schema({ timestamps: true, collection: 'carereportexports' })
export class CareReportExport {
  @Prop({ type: Types.ObjectId, ref: 'CareReport', required: true })
  careReportId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'PatientCareProgram', required: true })
  patientCareProgramId: Types.ObjectId;
  @Prop({ required: true, min: 1 }) reportVersion: number;
  @Prop({ required: true, minlength: 64, maxlength: 64 }) inputHash: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;
  @Prop({ required: true, enum: ['patient', 'doctor'] })
  audience: 'patient' | 'doctor';
  @Prop({ required: true, enum: CareReportExportFormat })
  format: CareReportExportFormat;
  @Prop({ required: true, default: 'care-report-export.v1' })
  rendererVersion: string;
  @Prop({ required: true, enum: CareReportExportStatus })
  status: CareReportExportStatus;
  @Prop({ required: true, trim: true, maxlength: 200 }) idempotencyKey: string;
  @Prop({ required: true, minlength: 64, maxlength: 64 }) requestHash: string;
  @Prop({ trim: true, maxlength: 500 }) storageKey?: string;
  @Prop({ trim: true, maxlength: 100 }) mimeType?: string;
  @Prop({ min: 0 }) byteSize?: number;
  @Prop({ minlength: 64, maxlength: 64 }) checksum?: string;
  @Prop() expiresAt?: Date;
  @Prop({ maxlength: 100 }) failureReasonCode?: string;
  @Prop({ min: 0, default: 0 }) attemptCount: number;
  @Prop({ maxlength: 100 }) leaseOwner?: string;
  @Prop() leaseExpiresAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const CareReportExportSchema =
  SchemaFactory.createForClass(CareReportExport);
CareReportExportSchema.index(
  { ownerId: 1, idempotencyKey: 1 },
  { name: 'ownerId_1_idempotencyKey_1', unique: true },
);
CareReportExportSchema.index(
  { status: 1, leaseExpiresAt: 1, _id: 1 },
  { name: 'status_1_leaseExpiresAt_1__id_1' },
);
CareReportExportSchema.index(
  { status: 1, expiresAt: 1, _id: 1 },
  { name: 'status_1_expiresAt_1__id_1' },
);
