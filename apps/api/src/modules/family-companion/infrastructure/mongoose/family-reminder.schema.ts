import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type FamilyReminderDocument = HydratedDocument<FamilyReminder>;

@Schema({ timestamps: true, collection: 'familyreminders' })
export class FamilyReminder {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'CareTask' })
  careTaskId?: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'FamilyLink',
    required: true,
  })
  familyLinkId: Types.ObjectId;
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'FamilyPermission',
    required: true,
  })
  permissionId: Types.ObjectId;
  @Prop({
    type: String,
    required: true,
    enum: ['missed_task', 'weekly_progress'],
  })
  reminderType: string;
  @Prop({ required: true, unique: true, maxlength: 240 }) uniqueKey: string;
  @Prop({
    type: String,
    required: true,
    enum: ['scheduled', 'dispatched', 'skipped'],
  })
  status: string;
  @Prop({ required: true }) scheduledAt: Date;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Notification' })
  notificationId?: Types.ObjectId;
  @Prop() dispatchedAt?: Date;
  @Prop({ maxlength: 80 }) skipReason?: string;
  @Prop({ type: String, maxlength: 64 }) patientTimeZone?: string;
}

export const FamilyReminderSchema =
  SchemaFactory.createForClass(FamilyReminder);
FamilyReminderSchema.index({ careTaskId: 1, status: 1 });
FamilyReminderSchema.index({ familyLinkId: 1, createdAt: -1 });
FamilyReminderSchema.index({ status: 1, scheduledAt: 1 });
