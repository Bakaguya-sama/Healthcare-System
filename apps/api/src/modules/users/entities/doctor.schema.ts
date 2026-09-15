import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DoctorVerificationStatus } from '@repo/shared-types';
import { HydratedDocument, Types } from 'mongoose';

export { DoctorVerificationStatus } from '@repo/shared-types';

export type DoctorDocument = HydratedDocument<Doctor>;

@Schema({ timestamps: true })
export class Doctor {
  @Prop({ type: Types.ObjectId, required: true, unique: true, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ type: String })
  specialty?: string;

  @Prop({ type: String })
  workplace?: string;

  @Prop({ type: [String], default: [] })
  verificationDocuments?: string[];

  @Prop({ type: Number, min: 0 })
  experienceYears?: number;

  @Prop({ type: Number, min: 0, max: 5, default: 0 })
  averageRating?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  ratingSum?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  reviewCount?: number;

  @Prop({ type: Date })
  verifiedAt?: Date;

  @Prop({
    type: String,
    enum: DoctorVerificationStatus,
    default: DoctorVerificationStatus.PENDING,
  })
  verificationStatus!: DoctorVerificationStatus;

  @Prop({ type: String })
  rejectReason?: string;
}

export const DoctorSchema = SchemaFactory.createForClass(Doctor);
