import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { CareProgram } from './care-program.entity';

export type CareRuleDocument = HydratedDocument<CareRule>;

export enum CareRuleStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  RETIRED = 'retired',
}

@Schema({ timestamps: true, collection: 'carerules' })
export class CareRule {
  @Prop({ type: Types.ObjectId, ref: CareProgram.name, required: true })
  careProgramId: Types.ObjectId;
  @Prop({ required: true, min: 1 }) version: number;
  @Prop({ required: true, enum: CareRuleStatus, default: CareRuleStatus.DRAFT })
  status: CareRuleStatus;
  @Prop({ type: [MongooseSchema.Types.Mixed], required: true, default: [] })
  rules: Record<string, unknown>[];
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  dataSources: Record<string, unknown>[];
  @Prop({ type: MongooseSchema.Types.Mixed }) testResults?: Record<
    string,
    unknown
  >;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' }) activatedBy?: Types.ObjectId;
  @Prop({ type: Date }) activatedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) retiredBy?: Types.ObjectId;
  @Prop({ type: Date }) retiredAt?: Date;
}

export const CareRuleSchema = SchemaFactory.createForClass(CareRule);
CareRuleSchema.index(
  { careProgramId: 1, version: 1 },
  { name: 'careProgramId_1_version_1', unique: true },
);
CareRuleSchema.index(
  { careProgramId: 1, status: 1 },
  { name: 'careProgramId_1_status_1' },
);
CareRuleSchema.index(
  { careProgramId: 1 },
  {
    name: 'careProgramId_active_unique',
    unique: true,
    partialFilterExpression: { status: CareRuleStatus.ACTIVE },
  },
);
