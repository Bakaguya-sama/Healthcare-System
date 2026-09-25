import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DoctorVerificationStatus } from '../../../../core/domain/user.enums';

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
}

export const DoctorProfileSchema = SchemaFactory.createForClass(DoctorProfile);
