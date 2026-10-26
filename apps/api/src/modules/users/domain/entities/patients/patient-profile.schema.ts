import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PatientProfileDocument = HydratedDocument<PatientProfile>;

@Schema({ timestamps: true, collection: 'patients' })
export class PatientProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;
}

export const PatientProfileSchema =
  SchemaFactory.createForClass(PatientProfile);
