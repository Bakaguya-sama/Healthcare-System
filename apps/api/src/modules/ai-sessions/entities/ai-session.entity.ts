import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum SessionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

export type AiSessionDocument = AiSession & Document;

@Schema({ timestamps: true })
export class AiSession extends Document {
  @Prop({ required: true, type: Types.ObjectId })
  patientId: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(SessionStatus), default: SessionStatus.ACTIVE })
  status: SessionStatus;

  @Prop()
  startedAt?: Date;

  @Prop()
  endedAt?: Date;
}

export const AiSessionSchema = SchemaFactory.createForClass(AiSession);

// Create indexes
AiSessionSchema.index({ patientId: 1, status: 1 });
AiSessionSchema.index({ patientId: 1, createdAt: -1 });
AiSessionSchema.index({ status: 1, createdAt: -1 });
