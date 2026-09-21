import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

@Schema({ timestamps: true })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  doctorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Consultation', required: true })
  consultationId: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ required: true })
  comment: string;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  helpfulBy!: Types.ObjectId[];

  @Prop({ type: Number, default: 0, min: 0 })
  helpfulCount!: number;

  @Prop({ type: Boolean, default: false })
  flagged!: boolean;

  @Prop({ type: String })
  adminNotes?: string;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// Add indexes for performance
ReviewSchema.index({ doctorId: 1, createdAt: -1 });
ReviewSchema.index({ patientId: 1, createdAt: -1 });
ReviewSchema.index({ rating: 1 });
ReviewSchema.index(
  { consultationId: 1 },
  { unique: true, sparse: true, name: 'consultationId_unique' },
);
