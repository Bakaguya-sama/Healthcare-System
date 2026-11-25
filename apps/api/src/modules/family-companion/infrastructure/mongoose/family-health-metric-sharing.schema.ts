import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FamilyHealthMetricSharingDocument =
  HydratedDocument<FamilyHealthMetricSharing>;

/** One revision per consent change; previous revisions remain available for audit. */
@Schema({ timestamps: true, collection: 'familyhealthmetricsharings' })
export class FamilyHealthMetricSharing {
  @Prop({ type: Types.ObjectId, ref: 'FamilyLink', required: true })
  familyLinkId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  familyUserId: Types.ObjectId;
  @Prop({ required: true, min: 1 }) invitationVersion: number;
  @Prop({ required: true, min: 1 }) revision: number;
  @Prop({ required: true, enum: ['active', 'revoked', 'superseded'] })
  status: string;
  @Prop({ required: true, enum: ['all', 'selected'] }) scope: string;
  @Prop({ type: [String], default: [] }) metricTypes: string[];
  @Prop({ required: true, maxlength: 64 }) consentVersion: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  consentedBy: Types.ObjectId;
  @Prop({ required: true }) consentedAt: Date;
  @Prop() revokedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) revokedBy?: Types.ObjectId;
}

export const FamilyHealthMetricSharingSchema = SchemaFactory.createForClass(
  FamilyHealthMetricSharing,
);
FamilyHealthMetricSharingSchema.index(
  { familyLinkId: 1, invitationVersion: 1, revision: 1 },
  { name: 'family_link_invitation_revision', unique: true },
);
FamilyHealthMetricSharingSchema.index(
  { familyLinkId: 1, invitationVersion: 1 },
  {
    name: 'family_link_active_sharing',
    unique: true,
    partialFilterExpression: { status: 'active' },
  },
);
