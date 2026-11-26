import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type FamilyReminderQuotaDocument = HydratedDocument<FamilyReminderQuota>;

/** Operational state only; contains no task or clinical information. */
@Schema({ timestamps: true, collection: 'familyreminderquotas' })
export class FamilyReminderQuota {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  companionUserId: Types.ObjectId;
  @Prop({ type: Date }) lastMissedTaskDispatchedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const FamilyReminderQuotaSchema =
  SchemaFactory.createForClass(FamilyReminderQuota);
FamilyReminderQuotaSchema.index(
  { companionUserId: 1 },
  { name: 'companionUserId_1_unique', unique: true },
);
