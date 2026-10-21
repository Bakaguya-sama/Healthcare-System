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
  WAITING = 'waiting',
  IN_CONSULTATION = 'in_consultation',
  INTERRUPTED = 'interrupted',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show',
}

/** Immutable server-owned billing treatment captured when a consultation is created. */
export enum ConsultationQuotaPolicy {
  CONSULTATION_LIMIT = 'consultation_limit',
  CARE_PROGRAM_INCLUDED = 'care_program_included',
}

@Schema({ timestamps: true, collection: 'consultations' })
export class Consultation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  doctorId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PatientCareProgram' })
  patientCareProgramId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CareAlert' })
  careAlertId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AvailabilitySlot' })
  availabilitySlotId?: Types.ObjectId;

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
  /** Timestamp when the durable pre-cancellation warning was enqueued. */
  @Prop() onDemandTimeoutWarningQueuedAt?: Date;
  /** The sole connection-based extension; its presence means it was consumed. */
  @Prop() onDemandTimeoutExtensionExpiresAt?: Date;
  /** Scheduled consultations are reviewed, never auto-cancelled, after 24 hours. */
  @Prop() scheduledStaleReviewQueuedAt?: Date;
  @Prop() declinedReason?: string;
  @Prop() scheduledStartAt?: Date;
  @Prop() scheduledEndAt?: Date;
  @Prop({ maxlength: 64 }) timezone?: string;
  @Prop({ type: Number, required: true, default: 30, min: 1 })
  expectedDurationMinutes!: number;
  @Prop({ type: Number, min: 0 }) estimatedWaitMinutes?: number;
  @Prop() overtimeStartedAt?: Date;
  @Prop({ type: Object }) bookingSettingsSnapshot?: Record<string, unknown>;
  @Prop({
    type: String,
    enum: ConsultationQuotaPolicy,
    default: ConsultationQuotaPolicy.CONSULTATION_LIMIT,
  })
  quotaPolicy?: ConsultationQuotaPolicy;
  /** Administrative exemption for explicitly identified pre-ledger bookings. */
  @Prop({ type: Boolean }) legacyQuotaExempt?: boolean;
  @Prop() patientNotes?: string;
  @Prop() doctorNotes?: string;
  @Prop({ type: Object }) followUp?: Record<string, unknown>;
  @Prop() queueJoinedAt?: Date;
  @Prop() queuePriorityAt?: Date;
  @Prop() calledAt?: Date;
  @Prop() sessionStartedAt?: Date;
  @Prop() interruptedAt?: Date;
  @Prop({ maxlength: 64 }) interruptionReason?: string;
  @Prop() resumedAt?: Date;
  @Prop() completedAt?: Date;
  @Prop() followUpAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) completedBy?: Types.ObjectId;
  @Prop() noShowAt?: Date;
  @Prop({ maxlength: 500 }) noShowReason?: string;
  @Prop() cancelledAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) cancelledBy?: Types.ObjectId;
  @Prop() cancellationReason?: string;
  @Prop() lastMessageAt?: Date;
  @Prop() lastMessageId?: string;
  @Prop() roomId?: string;
  @Prop() callStartedAt?: Date;
  @Prop() callEndedAt?: Date;
  @Prop({ maxlength: 64 }) callEndReason?: string;
  @Prop({ type: Object }) consultationConsent?: Record<string, unknown>;
  @Prop({ type: Object }) aiConsultationBrief?: Record<string, unknown>;
}

export const ConsultationSchema = SchemaFactory.createForClass(Consultation);
ConsultationSchema.index({
  doctorId: 1,
  requestStatus: 1,
  requestedAt: -1,
  _id: -1,
});
ConsultationSchema.index(
  { mode: 1, requestStatus: 1, sessionStatus: 1, respondedAt: 1, _id: 1 },
  { name: 'stale_on_demand_recovery' },
);
ConsultationSchema.index(
  { mode: 1, requestStatus: 1, sessionStatus: 1, scheduledStartAt: 1, _id: 1 },
  { name: 'stale_scheduled_review' },
);
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
ConsultationSchema.index(
  { careAlertId: 1 },
  { name: 'careAlertId_1_unique', unique: true, sparse: true },
);
ConsultationSchema.index(
  { availabilitySlotId: 1 },
  { name: 'availabilitySlotId_1', unique: true, sparse: true },
);
ConsultationSchema.index(
  {
    doctorId: 1,
    sessionStatus: 1,
    scheduledStartAt: 1,
    queuePriorityAt: 1,
    _id: 1,
  },
  {
    name: 'doctorId_1_sessionStatus_1_scheduledStartAt_1_queuePriorityAt_1__id_1',
  },
);
ConsultationSchema.index(
  { patientCareProgramId: 1, requestedAt: 1, _id: 1 },
  { name: 'patientCareProgramId_1_requestedAt_1__id_1' },
);
