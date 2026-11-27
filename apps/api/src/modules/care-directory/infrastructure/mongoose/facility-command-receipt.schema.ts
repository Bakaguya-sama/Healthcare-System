import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FacilityCommandReceiptDocument = HydratedDocument<FacilityCommandReceipt>;

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'facilitycommandreceipts' })
export class FacilityCommandReceipt {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' }) actorId: Types.ObjectId;
  @Prop({ required: true }) operation: string;
  @Prop({ required: true }) keyHash: string;
  @Prop({ required: true }) fingerprint: string;
  @Prop({ required: true, type: Object }) result: Record<string, unknown>;
  @Prop({ required: true }) expiresAt: Date;
}
export const FacilityCommandReceiptSchema = SchemaFactory.createForClass(FacilityCommandReceipt);
FacilityCommandReceiptSchema.index({ actorId: 1, operation: 1, keyHash: 1 }, { name: 'actor_operation_keyhash_unique', unique: true });
FacilityCommandReceiptSchema.index({ expiresAt: 1 }, { name: 'facility_command_receipt_ttl', expireAfterSeconds: 0 });
