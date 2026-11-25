import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FamilyCommandReceiptDocument =
  HydratedDocument<FamilyCommandReceipt>;

@Schema({ collection: 'familycommandreceipts', timestamps: true })
export class FamilyCommandReceipt {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  actorId: Types.ObjectId;
  @Prop({ required: true, trim: true, maxlength: 80 }) operation: string;
  @Prop({ required: true, trim: true, maxlength: 64 }) keyHash: string;
  @Prop({ required: true, trim: true, maxlength: 64 }) requestHash: string;
  @Prop({ type: Object, required: true }) result: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const FamilyCommandReceiptSchema =
  SchemaFactory.createForClass(FamilyCommandReceipt);
FamilyCommandReceiptSchema.index(
  { actorId: 1, operation: 1, keyHash: 1 },
  { name: 'actor_operation_keyhash_unique', unique: true },
);
FamilyCommandReceiptSchema.index(
  { createdAt: 1 },
  { name: 'family_command_receipt_ttl', expireAfterSeconds: 604800 },
);
