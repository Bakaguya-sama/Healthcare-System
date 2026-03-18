import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PatientDocument = HydratedDocument<Patient>;

@Schema({ timestamps: true })
export class Patient {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId; // 1-1 relationship with Users table

  @Prop({ required: true })
  fullName: string;

  @Prop()
  dateOfBirth?: Date;

  @Prop({ default: 0 })
  totalSessions: number;

  @Prop({ default: 0 })
  totalReviews: number;

  @Prop({ default: 0 })
  averageSessionRating: number;

  @Prop({ type: String, enum: ['active', 'inactive'], default: 'active' })
  status: string;

  @Prop()
  lastVisitAt?: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PatientSchema = SchemaFactory.createForClass(Patient);

// Indexes for better query performance
// userId already has index from unique: true, so only add other indexes
PatientSchema.index({ status: 1, createdAt: -1 });
PatientSchema.index({ totalSessions: -1 }); // For popular patients
