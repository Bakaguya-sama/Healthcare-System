import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FacilityDuplicateGuardDocument =
  HydratedDocument<FacilityDuplicateGuard>;

@Schema({ collection: 'facilityduplicateguards', versionKey: false })
export class FacilityDuplicateGuard {
  @Prop({ type: String, required: true, enum: ['hcmc'] })
  _id: string;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  revision: number;
}

export const FacilityDuplicateGuardSchema = SchemaFactory.createForClass(
  FacilityDuplicateGuard,
);
