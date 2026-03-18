import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AiFeedbackDocument = AiFeedback & Document;

@Schema({ timestamps: true })
export class AiFeedback extends Document {
  @Prop({ required: true, type: Types.ObjectId })
  patientId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  aiSessionId: Types.ObjectId;

  @Prop({ required: true })
  content: string;
}

export const AiFeedbackSchema = SchemaFactory.createForClass(AiFeedback);

// Create indexes
AiFeedbackSchema.index({ patientId: 1, createdAt: -1 });
AiFeedbackSchema.index({ aiSessionId: 1 });
