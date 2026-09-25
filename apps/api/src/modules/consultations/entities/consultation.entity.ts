import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConsultationDocument = HydratedDocument<Consultation>;

export enum ConsultationMode {
  ON_DEMAND = 'on_demand',
  SCHEDULED = 'scheduled',
}

export enum ConsultationRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum ConsultationSessionStatus {
  NOT_STARTED = 'not_started',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true, collection: 'consultations' })
export class Consultation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  doctorId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: ConsultationMode,
    required: true,
    default: ConsultationMode.ON_DEMAND,
  })
  mode!: ConsultationMode;

  @Prop({
    type: String,
    enum: ConsultationRequestStatus,
    required: true,
    default: ConsultationRequestStatus.PENDING,
  })
  requestStatus!: ConsultationRequestStatus;

  @Prop({
    type: String,
    enum: ConsultationSessionStatus,
    required: true,
    default: ConsultationSessionStatus.NOT_STARTED,
  })
  sessionStatus!: ConsultationSessionStatus;

  @Prop({ required: true, default: Date.now })
  requestedAt!: Date;

  @Prop() respondedAt?: Date;
  @Prop() requestExpiresAt?: Date;
  @Prop() declinedReason?: string;
  @Prop() scheduledStartAt?: Date;
  @Prop() scheduledEndAt?: Date;
  @Prop() patientNotes?: string;
  @Prop() doctorNotes?: string;
  @Prop() sessionStartedAt?: Date;
  @Prop() completedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) completedBy?: Types.ObjectId;
  @Prop() cancelledAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) cancelledBy?: Types.ObjectId;
  @Prop() cancellationReason?: string;
  @Prop() lastMessageAt?: Date;
  @Prop() lastMessageId?: string;
  @Prop() roomId?: string;
}

export const ConsultationSchema = SchemaFactory.createForClass(Consultation);
ConsultationSchema.index({
  doctorId: 1,
  requestStatus: 1,
  requestedAt: -1,
  _id: -1,
});
ConsultationSchema.index({
  patientId: 1,
  requestStatus: 1,
  requestedAt: -1,
  _id: -1,
});
ConsultationSchema.index({
  doctorId: 1,
  sessionStatus: 1,
  scheduledStartAt: 1,
  _id: 1,
});
ConsultationSchema.index(
  { patientId: 1, doctorId: 1, requestStatus: 1 },
  {
    partialFilterExpression: {
      mode: ConsultationMode.ON_DEMAND,
      requestStatus: ConsultationRequestStatus.PENDING,
    },
    unique: true,
  },
);
ConsultationSchema.index({ roomId: 1 }, { unique: true, sparse: true });
