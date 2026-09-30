import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuthEventDocument = HydratedDocument<AuthEvent>;

export enum AuthEventType {
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  REFRESH_ROTATED = 'refresh_rotated',
  REFRESH_REUSED = 'refresh_reused',
  LOGOUT = 'logout',
  LOGOUT_ALL = 'logout_all',
  PASSWORD_CHANGED = 'password_changed',
  OTP_SENT = 'otp_sent',
  OTP_VERIFIED = 'otp_verified',
  OTP_FAILED = 'otp_failed',
  ACCOUNT_BANNED = 'account_banned',
  ACCOUNT_UNBANNED = 'account_unbanned',
}

@Schema({ timestamps: true, collection: 'auth_events' })
export class AuthEvent {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  userId?: Types.ObjectId | null;

  @Prop({ type: String, enum: AuthEventType, required: true, index: true })
  eventType!: AuthEventType;

  @Prop({ type: String, default: null })
  email?: string | null;

  @Prop({ type: String, default: null })
  ipAddress?: string | null;

  @Prop({ type: String, default: null })
  userAgent?: string | null;

  @Prop({ type: Object, default: null })
  metadata?: Record<string, unknown> | null;
}

export const AuthEventSchema = SchemaFactory.createForClass(AuthEvent);
AuthEventSchema.index({ userId: 1, createdAt: -1, _id: -1 });
AuthEventSchema.index({ eventType: 1, createdAt: -1, _id: -1 });
