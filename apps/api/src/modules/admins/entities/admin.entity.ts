import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AdminDocument = HydratedDocument<Admin>;

export enum AdminRole {
  SUPER_ADMIN = 'super_admin', // Toàn quyền
  USER_MANAGER = 'user_manager', // Chỉ duyệt/khóa User
  AI_MANAGER = 'ai_manager', // Chỉ quản lý Knowledge Base & Blacklist
}

@Schema({ timestamps: true })
export class Admin {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId; // 1-1 relationship with Users table

  @Prop({ required: true })
  fullName: string;

  @Prop({
    enum: AdminRole,
    default: AdminRole.USER_MANAGER,
  })
  adminRole: AdminRole;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);

// Indexes for better query performance
// userId already has index from unique: true, so only add other indexes
AdminSchema.index({ adminRole: 1 });
AdminSchema.index({ isActive: 1, createdAt: -1 });
