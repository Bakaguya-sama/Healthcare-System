import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OAuthIdentityDocument = HydratedDocument<OAuthIdentity>;

@Schema({ timestamps: true, collection: 'oauth_identities' })
export class OAuthIdentity {
  @Prop({ required: true, enum: ['google'] }) provider!: 'google';
  @Prop({ required: true }) providerAccountId!: string;
  @Prop({ type: Types.ObjectId, required: true, ref: 'User', index: true })
  userId!: Types.ObjectId;
  @Prop({ type: String, default: null }) providerEmail?: string | null;
  @Prop({ type: Date, default: Date.now }) linkedAt!: Date;
}
export const OAuthIdentitySchema = SchemaFactory.createForClass(OAuthIdentity);
OAuthIdentitySchema.index(
  { provider: 1, providerAccountId: 1 },
  { unique: true },
);
OAuthIdentitySchema.index({ userId: 1, provider: 1 }, { unique: true });
OAuthIdentitySchema.index(
  { provider: 1, providerEmail: 1 },
  {
    unique: true,
    partialFilterExpression: { providerEmail: { $type: 'string' } },
  },
);
