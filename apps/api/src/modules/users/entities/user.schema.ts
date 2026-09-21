import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserRole, AccountStatus } from '../../../core/domain/user.enums';
import {
  DoctorProfile,
  DoctorProfileSchema,
} from '../doctors/schemas/doctor-profile.schema';
import {
  AdminProfile,
  AdminProfileSchema,
} from '../admins/schemas/admin-profile.schema';
import { Address, AddressSchema } from './address.schema';

export type UserDocument = HydratedDocument<User>;

// timestamps: true -> Mongoose tự thêm & quản lý createdAt / updatedAt (camelCase, tự động)
@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  // select: false -> mặc định KHÔNG trả về passwordHash khi query, phải .select('+passwordHash') khi cần (vd lúc login)
  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop() gender: string;

  @Prop() dateOfBirth: Date;

  @Prop({ type: String, enum: UserRole, required: true })
  role: UserRole;

  @Prop() phoneNumber: string;

  // Ảnh đại diện chung cho Bác sĩ, Bệnh nhân, Admin
  @Prop() avatarUrl: string;

  @Prop() avatarPublicId: string;

  @Prop({ type: String, enum: AccountStatus, default: AccountStatus.ACTIVE })
  accountStatus: AccountStatus;

  @Prop({ default: false }) isOnline: boolean;

  @Prop({ type: AddressSchema }) address: Address;

  @Prop() banReason: string;

  // Chỉ có giá trị khi role = 'doctor'
  @Prop({ type: DoctorProfileSchema })
  doctorProfile?: DoctorProfile;

  // Chỉ có giá trị khi role = 'admin'
  @Prop({ type: AdminProfileSchema })
  adminProfile?: AdminProfile;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1, accountStatus: 1 });
UserSchema.index({ 'doctorProfile.specialty': 1 });
UserSchema.index({ 'doctorProfile.verificationStatus': 1 });
UserSchema.index({ 'doctorProfile.averageRating': -1 });
