import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PatientCareProgramDocument = HydratedDocument<PatientCareProgram>;

export enum PatientCareProgramStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true, collection: 'patientcareprograms' })
export class PatientCareProgram {
  @Prop({ required: true, min: 1, default: 1 }) revision: number;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  doctorId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CareProgram', required: true })
  careProgramId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CareRule', required: true })
  careRuleId: Types.ObjectId;
  @Prop({
    required: true,
    enum: PatientCareProgramStatus,
    default: PatientCareProgramStatus.PENDING,
  })
  status: PatientCareProgramStatus;
  @Prop({ required: true, maxlength: 64 }) timezone: string;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true }) consent: Record<
    string,
    unknown
  >;
  @Prop({ type: MongooseSchema.Types.Mixed }) baselineAnswers?: Record<
    string,
    unknown
  >;
  @Prop({ type: Date }) baselineCompletedAt?: Date;
  @Prop({ type: Date }) pauseRequestedAt?: Date;
  @Prop({ maxlength: 500 }) pauseRequestReason?: string;
  @Prop({ type: MongooseSchema.Types.Mixed }) customSettings?: Record<
    string,
    unknown
  >;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  programConfig: Record<string, unknown>;
  @Prop({ type: Date }) startedAt?: Date;
  @Prop({ type: Date }) expectedEndAt?: Date;
  @Prop({ type: Date }) pausedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) pausedBy?: Types.ObjectId;
  @Prop({ maxlength: 500 }) pauseReason?: string;
  @Prop({ type: Date }) resumedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) resumedBy?: Types.ObjectId;
  @Prop({ type: Date }) completedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) completedBy?: Types.ObjectId;
  @Prop({ maxlength: 500 }) completionReason?: string;
  @Prop({ type: Date }) cancelledAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) cancelledBy?: Types.ObjectId;
  @Prop({ maxlength: 500 }) cancellationReason?: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

export const PatientCareProgramSchema =
  SchemaFactory.createForClass(PatientCareProgram);
PatientCareProgramSchema.index(
  { patientId: 1, status: 1, createdAt: -1 },
  { name: 'patientId_1_status_1_createdAt_-1' },
);
PatientCareProgramSchema.index(
  { doctorId: 1, status: 1, updatedAt: -1 },
  { name: 'doctorId_1_status_1_updatedAt_-1' },
);
PatientCareProgramSchema.index(
  { careProgramId: 1, status: 1 },
  { name: 'careProgramId_1_status_1' },
);
PatientCareProgramSchema.index(
  { patientId: 1, careProgramId: 1 },
  {
    name: 'patientId_1_careProgramId_active_unique',
    unique: true,
    partialFilterExpression: {
      status: {
        $in: [
          PatientCareProgramStatus.PENDING,
          PatientCareProgramStatus.ACTIVE,
          PatientCareProgramStatus.PAUSED,
        ],
      },
    },
  },
);
