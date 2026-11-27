import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AuthSessionDocument = HydratedDocument<AuthSession>;

@Schema({ timestamps: true, collection: 'auth_sessions' })
export class AuthSession {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true, select: false })
  refreshTokenHash!: string;

  @Prop({ required: true, index: true })
  familyId!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt?: Date | null;

  @Prop({ type: String, default: null })
  revokeReason?: string | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null, ref: 'AuthSession' })
  replacedBySessionId?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  userAgent?: string | null;

  /** A one-way, truncated network fingerprint; raw IPs never enter sessions. */
  @Prop({ type: String, default: null })
  networkFingerprint?: string | null;

  @Prop({ type: String, default: null })
  deviceLabel?: string | null;

  @Prop({ type: Date, default: Date.now })
  issuedAt!: Date;

  @Prop({ type: Date, default: Date.now })
  lastActiveAt!: Date;
}

export const AuthSessionSchema = SchemaFactory.createForClass(AuthSession);
AuthSessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });
AuthSessionSchema.index({ familyId: 1, revokedAt: 1 });
AuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
