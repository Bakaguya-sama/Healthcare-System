import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AdminDocument = HydratedDocument<Admin>;

export enum AdminRole {
  SUPER_ADMIN = 'super_admin', // Toàn quyền
  USER_ADMIN = 'user_admin', // Chỉ duyệt/khóa User
  AI_ADMIN = 'ai_admin', // Chỉ quản lý Knowledge Base & Blacklist
}

@Schema({ timestamps: true })
export class Admin {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId; // 1-1 relationship with Users table

  @Prop({
    enum: AdminRole,
    default: AdminRole.USER_ADMIN,
  })
  adminRole!: AdminRole;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);

// Indexes for better query performance
AdminSchema.index({ adminRole: 1 });
AdminSchema.index({ createdAt: -1 });
