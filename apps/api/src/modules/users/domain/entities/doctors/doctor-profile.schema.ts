import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DoctorVerificationStatus } from '../../../../../core/domain/user.enums';

export const DOCTOR_BOOKING_SETTINGS_LIMITS = {
  bufferMinutes: { min: 0, max: 60 },
  minNoticeMinutes: { min: 0, max: 7 * 24 * 60 },
  cancellationDeadlineMinutes: { min: 0, max: 7 * 24 * 60 },
  checkInEarlyMinutes: { min: 0, max: 24 * 60 },
  noShowAfterMinutes: { min: 0, max: 24 * 60 },
} as const;

/** Mutable doctor policy; every booking persists an immutable copy. */
@Schema({ _id: false })
export class DoctorBookingSettings {
  @Prop({ type: String, enum: ['instant'], required: true, default: 'instant' })
  bookingPolicy!: 'instant';

  @Prop({ type: Number, min: 0, max: 60, required: true })
  bufferMinutes!: number;

  @Prop({ type: Number, min: 0, max: 7 * 24 * 60, required: true })
  minNoticeMinutes!: number;

  @Prop({ type: Number, min: 0, max: 7 * 24 * 60, required: true })
  cancellationDeadlineMinutes!: number;

  @Prop({ type: Number, min: 0, max: 24 * 60, required: true })
  checkInEarlyMinutes!: number;

  @Prop({ type: Number, min: 0, max: 24 * 60, required: true })
  noShowAfterMinutes!: number;

  @Prop({ type: Date, required: true, default: Date.now })
  effectiveFrom!: Date;

  @Prop({ type: Date, required: true, default: Date.now })
  updatedAt!: Date;

  @Prop({ type: String })
  updatedBy?: string;

  @Prop({ type: String, maxlength: 500 })
  overrideReason?: string;
}

export const DoctorBookingSettingsSchema = SchemaFactory.createForClass(
  DoctorBookingSettings,
);

@Schema({ _id: false })
export class DoctorProfile {
  @Prop() specialty: string;

  @Prop() workplace: string;

  // Mảng link file PDF/ảnh bằng cấp, chứng chỉ hành nghề
  @Prop({ type: [String], default: [] })
  verificationDocuments: string[];

  @Prop() experienceYears: number;

  @Prop({ default: 0 }) averageRating: number;

  @Prop({ default: 0 }) ratingSum: number;

  @Prop({ default: 0 }) reviewCount: number;

  @Prop() verifiedAt: Date;

  @Prop() rejectReason: string;

  @Prop({
    type: String,
    enum: DoctorVerificationStatus,
    default: DoctorVerificationStatus.PENDING,
  })
  verificationStatus: DoctorVerificationStatus;

  @Prop({ type: DoctorBookingSettingsSchema, required: false })
  bookingSettings?: DoctorBookingSettings;
}

export const DoctorProfileSchema = SchemaFactory.createForClass(DoctorProfile);
