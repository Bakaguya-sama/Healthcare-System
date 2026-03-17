import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserRole } from '../enums/user-role.enum';

export type UserDocument = HydratedDocument<UserEntity>;

export enum DoctorVerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum AccountStatus {
  ACTIVE = 'active',
  BANNED = 'banned',
}

export interface LockRecord {
  lockedAt: Date;
  lockedBy: Types.ObjectId;
  reason: string;
  unlockedAt?: Date;
  unlockedBy?: Types.ObjectId;
}

@Schema({ timestamps: true })
export class UserEntity {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  name: string;

  @Prop({ enum: UserRole, default: UserRole.PATIENT })
  role: UserRole;

  @Prop()
  avatarUrl?: string;

  @Prop()
  phone?: string;

  @Prop()
  dateOfBirth?: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ enum: AccountStatus, default: AccountStatus.ACTIVE })
  accountStatus: AccountStatus;

  // Doctor-specific fields
  @Prop()
  specialization?: string;

  @Prop()
  licenseNumber?: string;

  @Prop()
  workplace?: string; // Nơi làm việc

  @Prop({ type: [String], default: [] })
  verificationDocuments?: string[]; // Mảng URL file PDF/Ảnh bằng cấp, chứng chỉ

  @Prop({ type: Number, min: 0 })
  experienceYears?: number; // Số năm kinh nghiệm

  @Prop({ type: Number, min: 0, max: 5, default: 0 })
  averageRating?: number; // Điểm đánh giá trung bình

  @Prop({ default: false })
  isOnline?: boolean; // Trạng thái online

  @Prop({ type: [String], default: [] })
  availableSlots?: string[];

  // Doctor verification fields
  @Prop({
    enum: DoctorVerificationStatus,
    default: DoctorVerificationStatus.PENDING,
  })
  doctorVerificationStatus?: DoctorVerificationStatus;

  @Prop()
  verificationNotes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  verifiedBy?: Types.ObjectId;

  @Prop()
  verifiedAt?: Date;

  // Account lock history
  @Prop({ type: [Object], default: [] })
  lockHistory: LockRecord[];
}

export const UserEntitySchema = SchemaFactory.createForClass(UserEntity);
