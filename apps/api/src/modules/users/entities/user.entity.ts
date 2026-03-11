import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserRole } from '../enums/user-role.enum';

export type UserDocument = HydratedDocument<UserEntity>;

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

  // Doctor-specific fields
  @Prop()
  specialization?: string;

  @Prop()
  licenseNumber?: string;

  @Prop({ type: [String], default: [] })
  availableSlots?: string[];
}

export const UserEntitySchema = SchemaFactory.createForClass(UserEntity);
