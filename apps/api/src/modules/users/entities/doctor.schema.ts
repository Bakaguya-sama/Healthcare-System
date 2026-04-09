import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DoctorDocument = HydratedDocument<Doctor>;

export enum DoctorVerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Schema({ timestamps: true })
export class Doctor {
  @Prop({ required: true, unique: true, ref: 'User' })
  userId: Types.ObjectId;

  @Prop()
  specialty?: string;

  @Prop()
  workplace?: string;

  @Prop({ type: [String], default: [] })
  verificationDocuments?: string[];

  @Prop({ type: Number, min: 0 })
  experienceYears?: number;

  @Prop({ type: Number, min: 0, max: 5, default: 0 })
  averageRating?: number;

  @Prop()
  verifiedAt?: Date;

  // Doctor verification fields
  @Prop({
    enum: DoctorVerificationStatus,
    default: DoctorVerificationStatus.PENDING,
  })
  verificationStatus: DoctorVerificationStatus;

  @Prop()
  rejectReason?: string;
}

export const DoctorSchema = SchemaFactory.createForClass(Doctor);
