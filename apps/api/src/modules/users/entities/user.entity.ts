import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserRole } from '../enums/user-role.enum';

export type UserDocument = HydratedDocument<UserEntity>;

export enum AccountStatus {
  ACTIVE = 'active',
  BANNED = 'banned',
}

@Schema({ timestamps: true })
export class UserEntity {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  fullName: string;

  @Prop()
  gender?: string;

  @Prop()
  dateOfBirth?: Date;

  @Prop({ enum: UserRole, default: UserRole.PATIENT })
  role: UserRole;

  @Prop()
  phoneNumber?: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ enum: AccountStatus, default: AccountStatus.ACTIVE })
  accountStatus: AccountStatus;

  @Prop({ default: false })
  isOnline?: boolean;

  @Prop()
  otpCode?: string;

  @Prop()
  otpExpiresAt?: Date;

  @Prop({
    type: {
      street: String,
      ward: String,
      district: String,
      city: String,
      country: String,
    },
  })
  address?: {
    street?: string;
    ward?: string;
    district?: string;
    city?: string;
    country?: string;
  };
}

export const UserEntitySchema = SchemaFactory.createForClass(UserEntity);
