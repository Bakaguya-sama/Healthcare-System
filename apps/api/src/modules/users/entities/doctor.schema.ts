import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

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

  @Prop({ required: true })
  fullName: string;

  @Prop()
  dateOfBirth?: Date;

  @Prop({ required: false })
  specialization?: string;

  @Prop({ required: false })
  licenseNumber?: string;

  @Prop({ required: false })
  workplace?: string;

  @Prop({ type: [String], default: [] })
  verificationDocuments?: string[];

  @Prop({ type: Number, min: 0 })
  experienceYears?: number;

  @Prop({ type: Number, min: 0, max: 5, default: 0 })
  averageRating?: number;

  @Prop({ default: false })
  isOnline?: boolean;

  // Doctor verification fields
  @Prop({
    enum: DoctorVerificationStatus,
    default: DoctorVerificationStatus.PENDING,
  })
  verificationStatus: DoctorVerificationStatus;

  @Prop()
  verificationNotes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  verifiedBy?: Types.ObjectId;

  @Prop()
  verifiedAt?: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const DoctorSchema = SchemaFactory.createForClass(Doctor);
