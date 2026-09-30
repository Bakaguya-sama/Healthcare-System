import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type CareProgramDocument = HydratedDocument<CareProgram>;

export enum CareProgramStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  RETIRED = 'retired',
}

@Schema({ timestamps: true, collection: 'careprograms' })
export class CareProgram {
  @Prop({ required: true, trim: true, maxlength: 120 })
  programCode: string;

  @Prop({ required: true, min: 1 })
  version: number;

  // Optimistic-concurrency revision. This is distinct from the immutable
  // business version: editing a draft increments revision, publishing does not
  // mutate the Program's business configuration.
  @Prop({ required: true, min: 1, default: 1 })
  revision: number;

  @Prop({ required: true, trim: true, maxlength: 200 })
  name: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  diseaseKey: string;

  @Prop({ maxlength: 4000 })
  description?: string;

  @Prop({
    required: true,
    enum: CareProgramStatus,
    default: CareProgramStatus.DRAFT,
  })
  status: CareProgramStatus;

  @Prop({ type: MongooseSchema.Types.Mixed }) eligibilityForm?: Record<
    string,
    unknown
  >;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  baselineForm: Record<string, unknown>;
  @Prop({ type: [MongooseSchema.Types.Mixed], required: true, default: [] })
  taskTemplates: Record<string, unknown>[];
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  reminderPolicy: Record<string, unknown>;
  @Prop({ type: MongooseSchema.Types.Mixed }) reviewPolicy?: Record<
    string,
    unknown
  >;
  @Prop({ type: MongooseSchema.Types.Mixed }) completionCriteria?: Record<
    string,
    unknown
  >;
  @Prop({ type: [String], default: [] }) doctorEditableFields: string[];
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  contentJourney: Record<string, unknown>[];
  @Prop({ type: [MongooseSchema.Types.Mixed], required: true, default: [] })
  dataSources: Record<string, unknown>[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' }) publishedBy?: Types.ObjectId;
  @Prop({ type: Date }) publishedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) retiredBy?: Types.ObjectId;
  @Prop({ type: Date }) retiredAt?: Date;
}

export const CareProgramSchema = SchemaFactory.createForClass(CareProgram);
CareProgramSchema.index(
  { programCode: 1, version: 1 },
  { name: 'programCode_1_version_1', unique: true },
);
CareProgramSchema.index(
  { status: 1, diseaseKey: 1, publishedAt: -1 },
  { name: 'status_1_diseaseKey_1_publishedAt_-1' },
);
CareProgramSchema.index({ createdBy: 1 }, { name: 'createdBy_1' });
