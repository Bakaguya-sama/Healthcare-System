import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserRole } from '../../users/enums/user-role.enum';

export type UserDocument = HydratedDocument<User>;

export enum AccountStatus {
  ACTIVE = 'active',
  BANNED = 'banned',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  name: string;

  @Prop({ enum: UserRole, default: UserRole.PATIENT })
  role: UserRole;

  @Prop({ enum: AccountStatus, default: AccountStatus.ACTIVE })
  accountStatus: AccountStatus;

  @Prop({ required: false })
  gender?: string;

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

  @Prop({ required: false })
  refreshToken?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
