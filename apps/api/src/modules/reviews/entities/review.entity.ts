import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

export enum ReviewRating {
  ONE = 1,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
}

export enum ReviewStatus {
  ACTIVE = 'active',
  HIDDEN = 'hidden',
  FLAGGED = 'flagged',
}

@Schema({ timestamps: true })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  doctorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Session', required: false })
  doctorSessionId?: Types.ObjectId;

  @Prop({ required: true, enum: ReviewRating, min: 1, max: 5 })
  rating: number;

  @Prop({ required: true })
  comment: string;

  @Prop({ enum: ReviewStatus, default: ReviewStatus.ACTIVE })
  status: ReviewStatus;

  @Prop({ default: 0 })
  helpfulCount: number;

  @Prop({ type: [Types.ObjectId], default: [] })
  helpfulBy: Types.ObjectId[];

  @Prop({ required: false })
  adminNotes?: string;

  @Prop({ default: false })
  isVerifiedPurchase: boolean;

  @Prop({ type: { createdAt: Date, updatedAt: Date }, required: false })
  timestamps?: { createdAt: Date; updatedAt: Date };
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// Add indexes for performance
ReviewSchema.index({ doctorId: 1, createdAt: -1 });
ReviewSchema.index({ patientId: 1, createdAt: -1 });
ReviewSchema.index({ status: 1, createdAt: -1 });
ReviewSchema.index({ rating: 1 });
