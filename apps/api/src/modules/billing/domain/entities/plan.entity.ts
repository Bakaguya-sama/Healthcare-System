import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PlanDocument = HydratedDocument<Plan>;

export enum PlanStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  RETIRED = 'retired',
}

/** Immutable fields copied into a Subscription when a grant is issued. */
export type PlanSnapshot = {
  code: string;
  version: number;
  name: string;
  durationDays: number;
  aiRequestLimit: number;
  aiTokenLimit: number;
  aiQuotaPeriod: 'day' | 'subscription_cycle';
  consultationLimitPerCycle: number;
  activeCareProgramLimit: number;
  benefits: Record<string, unknown>;
};

@Schema({ timestamps: true, collection: 'plans' })
export class Plan {
  @Prop({ required: true, maxlength: 32, trim: true }) code: string;
  @Prop({ required: true, min: 1 }) version: number;
  @Prop({ required: true, maxlength: 160, trim: true }) name: string;
  @Prop({ maxlength: 2_000 }) description?: string;
  @Prop({ required: true, min: 0 }) price: number;
  @Prop({ required: true, default: 'VND', maxlength: 8 }) currency: string;
  @Prop({ required: true, min: 1, max: 366 }) durationDays: number;
  @Prop({ required: true, min: 0 }) aiRequestLimit: number;
  @Prop({ required: true, min: 0 }) aiTokenLimit: number;
  @Prop({ required: true, enum: ['day', 'subscription_cycle'] })
  aiQuotaPeriod: 'day' | 'subscription_cycle';
  @Prop({ required: true, min: 0 }) consultationLimitPerCycle: number;
  @Prop({ required: true, min: 0, max: 100 }) activeCareProgramLimit: number;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true }) benefits: Record<
    string,
    unknown
  >;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  refundPolicy: Record<string, unknown>;
  @Prop({ required: true, enum: PlanStatus, default: PlanStatus.DRAFT })
  status: PlanStatus;
  @Prop() effectiveFrom?: Date;
  @Prop() effectiveUntil?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' }) publishedBy?: Types.ObjectId;
  @Prop() publishedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) retiredBy?: Types.ObjectId;
  @Prop() retiredAt?: Date;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
PlanSchema.index(
  { code: 1, version: 1 },
  { name: 'code_1_version_1', unique: true },
);
PlanSchema.index(
  { code: 1, status: 1 },
  {
    name: 'code_1_status_published_unique',
    unique: true,
    partialFilterExpression: { status: PlanStatus.PUBLISHED },
  },
);
PlanSchema.index(
  { code: 1, status: 1, effectiveFrom: 1 },
  { name: 'code_1_status_1_effectiveFrom_1' },
);

export function snapshotPlan(plan: Plan): PlanSnapshot {
  return {
    code: plan.code,
    version: plan.version,
    name: plan.name,
    durationDays: plan.durationDays,
    aiRequestLimit: plan.aiRequestLimit,
    aiTokenLimit: plan.aiTokenLimit,
    aiQuotaPeriod: plan.aiQuotaPeriod,
    consultationLimitPerCycle: plan.consultationLimitPerCycle,
    activeCareProgramLimit: plan.activeCareProgramLimit,
    benefits: plan.benefits,
  };
}
