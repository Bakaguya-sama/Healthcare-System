import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type FamilyPermissionDocument = HydratedDocument<FamilyPermission>;

@Schema({ timestamps: true, collection: 'familypermissions' })
export class FamilyPermission {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'FamilyLink',
    required: true,
  })
  familyLinkId: Types.ObjectId;
  @Prop({ required: true, maxlength: 64 }) policyVersion: string;
  @Prop({ type: [String], required: true, default: [] }) permissions: string[];
  @Prop({ type: String, required: true, enum: ['active', 'revoked'] })
  status: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  grantedBy: Types.ObjectId;
  @Prop({ required: true }) grantedAt: Date;
  @Prop() revokedAt?: Date;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  revokedBy?: Types.ObjectId;
  @Prop({ maxlength: 160 }) revokeReason?: string;
}

export const FamilyPermissionSchema =
  SchemaFactory.createForClass(FamilyPermission);
FamilyPermissionSchema.index({ familyLinkId: 1, status: 1, createdAt: -1 });
FamilyPermissionSchema.index({ patientId: 1, status: 1, createdAt: -1 });
