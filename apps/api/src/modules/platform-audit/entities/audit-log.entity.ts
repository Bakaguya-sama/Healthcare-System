import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'auditlogs',
})
export class AuditLog {
  @Prop({ required: true, trim: true }) domain: string;
  @Prop({ required: true, trim: true }) entityType: string;
  @Prop({ type: Types.ObjectId }) entityId?: Types.ObjectId;
  @Prop({ required: true, trim: true }) action: string;
  @Prop({ type: Types.ObjectId, ref: 'User' }) userId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' }) actorId?: Types.ObjectId;
  @Prop({ trim: true }) fromStatus?: string;
  @Prop({ trim: true }) toStatus?: string;
  @Prop({ trim: true }) reason?: string;
  @Prop({ type: MongooseSchema.Types.Mixed }) metadata?: Record<
    string,
    unknown
  >;
  @Prop({ trim: true }) ipAddress?: string;
  @Prop({ trim: true }) userAgent?: string;
  @Prop({ type: Date }) expiresAt?: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index(
  { domain: 1, entityType: 1, entityId: 1, createdAt: -1 },
  { name: 'domain_1_entityType_1_entityId_1_createdAt_-1' },
);
AuditLogSchema.index(
  { userId: 1, createdAt: -1 },
  { name: 'userId_1_createdAt_-1' },
);
AuditLogSchema.index(
  { actorId: 1, createdAt: -1 },
  { name: 'actorId_1_createdAt_-1' },
);
AuditLogSchema.index(
  { domain: 1, action: 1, createdAt: -1 },
  { name: 'domain_1_action_1_createdAt_-1' },
);
AuditLogSchema.index(
  { expiresAt: 1 },
  { name: 'expiresAt_1', expireAfterSeconds: 0 },
);
