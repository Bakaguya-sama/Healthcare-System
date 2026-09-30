import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CareCommandIdempotencyDocument =
  HydratedDocument<CareCommandIdempotency>;

@Schema({ timestamps: true, collection: 'carecommandidempotencies' })
export class CareCommandIdempotency {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  actorId: Types.ObjectId;
  @Prop({ required: true, trim: true }) operation: string;
  @Prop({ required: true, trim: true }) key: string;
  @Prop({ required: true }) requestHash: string;
  @Prop({ required: true, trim: true }) entityType: 'careProgram' | 'careRule' | 'careEnrollment';
  @Prop({ type: Types.ObjectId, required: true }) entityId: Types.ObjectId;
}

export const CareCommandIdempotencySchema = SchemaFactory.createForClass(
  CareCommandIdempotency,
);
CareCommandIdempotencySchema.index(
  { actorId: 1, operation: 1, key: 1 },
  { name: 'actorId_1_operation_1_key_1', unique: true },
);
