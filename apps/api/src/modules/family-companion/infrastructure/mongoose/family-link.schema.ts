import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { FamilyLinkStatus } from '../../domain/policies/family-companion.policy';

export type FamilyLinkDocument = HydratedDocument<FamilyLink>;

@Schema({ timestamps: true, collection: 'familylinks', minimize: false })
export class FamilyLink {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' }) familyUserId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' })
  pendingRedeemerUserId?: Types.ObjectId;
  @Prop() pendingRedeemedAt?: Date;
  @Prop({ maxlength: 80, trim: true }) relationship?: string;
  @Prop({
    type: String,
    required: true,
    enum: ['pending', 'active', 'paused', 'declined', 'expired', 'revoked'],
  })
  status: FamilyLinkStatus;
  @Prop({ required: true, min: 1, default: 1 }) invitationVersion: number;
  @Prop({ type: String, sparse: true, maxlength: 160 }) idempotencyKey?: string;
  @Prop({ type: String, select: false, match: /^[a-f0-9]{64}$/ })
  idempotencyRequestHash?: string;
  @Prop({
    type: String,
    required: true,
    enum: ['shared_link', 'selected_contact'],
  })
  invitationDelivery: 'shared_link' | 'selected_contact';
  @Prop({ type: String, unique: true, sparse: true, select: false })
  invitationTokenHash?: string;
  @Prop({ type: String, sparse: true, select: false }) shortCodeHash?: string;
  @Prop() shortCodeExpiresAt?: Date;
  @Prop({ min: 0, default: 0 }) shortCodeFailedAttempts: number;
  @Prop() shortCodeLockedUntil?: Date;
  @Prop({ required: true }) invitedAt: Date;
  @Prop({ required: true }) invitationExpiresAt: Date;
  @Prop() acceptedAt?: Date;
  @Prop() pausedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) pausedBy?: Types.ObjectId;
  @Prop() resumedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) resumedBy?: Types.ObjectId;
  @Prop() declinedAt?: Date;
  @Prop({ maxlength: 160 }) declineReason?: string;
  @Prop() expiredAt?: Date;
  @Prop() revokedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) revokedBy?: Types.ObjectId;
  @Prop({ maxlength: 160 }) revokeReason?: string;
  @Prop({ maxlength: 64 }) consentVersion?: string;
  @Prop({ type: [String], required: true, default: [] }) permissions: string[];
  @Prop({ type: Types.ObjectId, ref: 'Subscription' })
  entitlementSubscriptionId?: Types.ObjectId;
  @Prop({ min: 0, max: 10 }) entitlementFamilyLinkLimit?: number;
  createdAt: Date;
  updatedAt: Date;
}

export const FamilyLinkSchema = SchemaFactory.createForClass(FamilyLink);
FamilyLinkSchema.index(
  { patientId: 1, familyUserId: 1 },
  {
    name: 'patientId_1_familyUserId_1',
    unique: true,
    partialFilterExpression: { familyUserId: { $type: 'objectId' } },
  },
);
FamilyLinkSchema.index(
  { patientId: 1, idempotencyKey: 1 },
  { name: 'patientId_1_idempotencyKey_1', unique: true, sparse: true },
);
FamilyLinkSchema.index(
  { patientId: 1, status: 1, updatedAt: -1 },
  { name: 'patientId_1_status_1_updatedAt_-1' },
);
FamilyLinkSchema.index(
  { familyUserId: 1, status: 1, updatedAt: -1 },
  { name: 'familyUserId_1_status_1_updatedAt_-1', sparse: true },
);
FamilyLinkSchema.index(
  { invitationTokenHash: 1 },
  { name: 'invitationTokenHash_1', unique: true, sparse: true },
);
FamilyLinkSchema.index(
  { invitationExpiresAt: 1, status: 1 },
  { name: 'invitationExpiresAt_1_status_1' },
);
