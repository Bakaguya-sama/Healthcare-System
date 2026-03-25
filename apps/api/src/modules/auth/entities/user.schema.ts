import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserRole } from '../../users/enums/user-role.enum';
import { ApiProperty } from '@nestjs/swagger';

export type UserDocument = HydratedDocument<User>;

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
export class User {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  fullName: string;

  @Prop({ enum: UserRole, default: UserRole.PATIENT })
  role: UserRole;

  @Prop({ enum: AccountStatus, default: AccountStatus.ACTIVE })
  accountStatus: AccountStatus;

  @Prop({ required: false })
  gender?: string;

  @Prop({ required: false })
  dateOfBirth?: Date;

  @Prop({ required: false })
  phoneNumber?: string;

  @Prop({ required: false })
  avatarUrl?: string;

  @Prop({
    type: {
      street: String,
      ward: String,
      district: String,
      city: String,
      country: String,
    },
    required: false,
  })
  address?: {
    street?: string;
    ward?: string;
    district?: string;
    city?: string;
    country?: string;
  };

  @Prop({ required: false })
  otpCode?: string;

  @Prop({ required: false })
  otpExpiresAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
