import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MedicalSpecialtyDocument = HydratedDocument<MedicalSpecialty>;

@Schema({ timestamps: true, collection: 'medicalspecialties' })
export class MedicalSpecialty {
  @Prop({ required: true, trim: true, lowercase: true, maxlength: 60 })
  code: string;
  @Prop({ required: true, trim: true, maxlength: 120 }) nameVi: string;
  @Prop({ type: [String], default: [] }) synonyms: string[];
  @Prop({ required: true, enum: ['active', 'retired'], default: 'active' })
  status: 'active' | 'retired';
  @Prop({ required: true, min: 1, default: 1 }) revision: number;
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  createdBy: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' }) updatedBy?: Types.ObjectId;
}

export const MedicalSpecialtySchema =
  SchemaFactory.createForClass(MedicalSpecialty);
MedicalSpecialtySchema.index(
  { code: 1 },
  { name: 'code_1_unique', unique: true },
);
MedicalSpecialtySchema.index(
  { status: 1, nameVi: 1, code: 1 },
  { name: 'status_1_nameVi_1_code_1' },
);
