import { createHash } from 'node:crypto';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import {
  CONSULTATION_USAGE_PORT,
  type ConsultationUsagePort,
} from '../../../../billing/public-api';
import { AccountStatus, UserRole } from '../../../../../core/domain/user.enums';
import { UsersService } from '../../../../users/public-api';
import { BookingException } from '../../errors/booking.exception';
import {
  AvailabilitySlot,
  AvailabilitySlotStatus,
} from '../../../domain/entities/availability/availability-slot.entity';
import {
  Consultation,
  ConsultationDocument,
  ConsultationMode,
  ConsultationQuotaPolicy,
  ConsultationRequestStatus,
  ConsultationSessionStatus,
} from '../../../domain/entities/consultations/consultation.entity';
import { CreateScheduledBookingDto } from '../../../presentation/dto/consultations/scheduled-booking.dto';
import { AvailabilitySlotService } from '../availability/availability-slot.service';
import { BookingPolicyService } from './booking-policy';

@Injectable()
export class ScheduledBookingService {
  constructor(
    @InjectModel(Consultation.name)
    private readonly consultations: Model<ConsultationDocument>,
    @InjectModel(AvailabilitySlot.name)
    private readonly slots: Model<AvailabilitySlot>,
    private readonly availability: AvailabilitySlotService,
    private readonly users: UsersService,
    private readonly policy: BookingPolicyService,
    @Inject(CONSULTATION_USAGE_PORT)
    private readonly usage: ConsultationUsagePort,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async book(
    patientId: string,
    idempotencyKey: string | undefined,
    dto: CreateScheduledBookingDto,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    await this.assertActivePatient(patientId);
    const key = this.keyHash(patientId, idempotencyKey!);
    const requestHash = this.requestHash(dto);
    const replay = await this.consultations.findOne({
      scheduledBookingKey: key,
    });
    if (replay) return this.replay(replay, requestHash);

    // Free-grant provisioning, when applicable, deliberately happens before
    // the booking transaction. The quota reservation itself is transactional.
    await this.prepareQuota(patientId);
    try {
      const consultation = await this.inTransaction(async (session) => {
        const insideReplay = await this.consultations
          .findOne({ scheduledBookingKey: key })
          .session(session);
        if (insideReplay) return this.replayDocument(insideReplay, requestHash);

        const slot = await this.loadBookableSlot(
          dto.availabilitySlotId,
          session,
        );
        const policy = this.policy.getScheduledPolicy();
        this.assertNotice(slot.startAt, policy.minNoticeMinutes);
        const claimed = await this.slots.findOneAndUpdate(
          { _id: slot._id, status: AvailabilitySlotStatus.AVAILABLE },
          { $set: { status: AvailabilitySlotStatus.BOOKED } },
          { returnDocument: 'after', session },
        );
        if (!claimed) this.throwAlreadyBooked();

        const consultationId = new Types.ObjectId();
        const duration = Math.max(
          1,
          Math.round((slot.endAt.getTime() - slot.startAt.getTime()) / 60_000),
        );
        const created = new this.consultations({
          _id: consultationId,
          patientId: new Types.ObjectId(patientId),
          doctorId: slot.doctorId,
          availabilitySlotId: slot._id,
          mode: ConsultationMode.SCHEDULED,
          requestStatus: ConsultationRequestStatus.ACCEPTED,
          sessionStatus: ConsultationSessionStatus.NOT_STARTED,
          quotaPolicy: ConsultationQuotaPolicy.CONSULTATION_LIMIT,
          requestedAt: new Date(),
          respondedAt: new Date(),
          scheduledStartAt: slot.startAt,
          scheduledEndAt: slot.endAt,
          timezone: slot.timezone,
          expectedDurationMinutes: duration,
          bookingSettingsSnapshot: {
            ...policy,
            defaultDurationMinutes: duration,
          },
          scheduledBookingKey: key,
          scheduledBookingRequestHash: requestHash,
          patientNotes: dto.patientNotes,
        });
        await created.save({ session });
        const reservation = await this.reserveQuota(
          String(consultationId),
          patientId,
          session,
        );
        if (reservation.status !== 'reserved') {
          throw new BookingException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'QUOTA_EXCEEDED',
            'Consultation quota could not be reserved',
          );
        }
        return created;
      });
      return this.response(consultation, 201);
    } catch (error: unknown) {
      if (this.isDuplicateKey(error)) {
        const concurrentReplay = await this.consultations.findOne({
          scheduledBookingKey: key,
        });
        if (concurrentReplay) return this.replay(concurrentReplay, requestHash);
        this.throwAlreadyBooked();
      }
      throw error;
    }
  }

  async reschedule(
    patientId: string,
    consultationId: string,
    idempotencyKey: string | undefined,
    availabilitySlotId: string,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    this.assertObjectId(consultationId, 'consultation');
    const key = this.keyHash(patientId, idempotencyKey!);
    const requestHash = this.requestHash({ availabilitySlotId });
    const consultation = await this.inTransaction(async (session) => {
      const current = await this.consultations
        .findById(consultationId)
        .session(session);
      if (!current) throw new NotFoundException('Consultation not found');
      if (!current.patientId.equals(new Types.ObjectId(patientId))) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Only the patient owner can reschedule this consultation',
        });
      }
      if (current.lastRescheduleKey === key) {
        if (current.lastRescheduleRequestHash !== requestHash) {
          this.throwIdempotencyConflict();
        }
        return current;
      }
      this.assertReschedulable(current);
      const next = await this.loadBookableSlot(availabilitySlotId, session);
      if (!next.doctorId.equals(current.doctorId)) {
        throw new BookingException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'RESCHEDULE_DOCTOR_MISMATCH',
          'Reschedule slot must belong to the same doctor',
        );
      }
      const policy = this.policy.getScheduledPolicy();
      this.assertNotice(next.startAt, policy.minNoticeMinutes);
      const claimed = await this.slots.findOneAndUpdate(
        { _id: next._id, status: AvailabilitySlotStatus.AVAILABLE },
        { $set: { status: AvailabilitySlotStatus.BOOKED } },
        { returnDocument: 'after', session },
      );
      if (!claimed) this.throwAlreadyBooked();
      if (!current.availabilitySlotId) {
        throw new BookingException(
          HttpStatus.CONFLICT,
          'SLOT_STATE_CONFLICT',
          'Scheduled consultation has no source slot',
        );
      }
      await this.availability.reopenAfterCancellation(
        current.availabilitySlotId,
        current._id,
        session,
      );
      const duration = Math.max(
        1,
        Math.round((next.endAt.getTime() - next.startAt.getTime()) / 60_000),
      );
      current.availabilitySlotId = next._id;
      current.scheduledStartAt = next.startAt;
      current.scheduledEndAt = next.endAt;
      current.timezone = next.timezone;
      current.expectedDurationMinutes = duration;
      current.bookingSettingsSnapshot = {
        ...policy,
        defaultDurationMinutes: duration,
      };
      current.lastRescheduleKey = key;
      current.lastRescheduleRequestHash = requestHash;
      await current.save({ session });
      return current;
    });
    return this.response(consultation);
  }

  async releaseSlotForCancellation(
    consultation: ConsultationDocument,
    session: ClientSession,
  ) {
    if (
      consultation.mode === ConsultationMode.SCHEDULED &&
      consultation.availabilitySlotId
    ) {
      await this.availability.reopenAfterCancellation(
        consultation.availabilitySlotId,
        consultation._id,
        session,
      );
    }
  }

  private assertReschedulable(consultation: ConsultationDocument) {
    if (
      consultation.mode !== ConsultationMode.SCHEDULED ||
      consultation.requestStatus !== ConsultationRequestStatus.ACCEPTED ||
      consultation.sessionStatus !== ConsultationSessionStatus.NOT_STARTED ||
      !consultation.scheduledStartAt
    ) {
      throw new BookingException(
        HttpStatus.CONFLICT,
        'INVALID_STATE_TRANSITION',
        'Consultation cannot be rescheduled from its current state',
      );
    }
    const cutoff =
      consultation.bookingSettingsSnapshot?.cancellationDeadlineMinutes;
    if (typeof cutoff !== 'number') {
      throw new BookingException(
        HttpStatus.CONFLICT,
        'BOOKING_POLICY_UNAVAILABLE',
        'Reschedule policy snapshot is unavailable',
      );
    }
    if (
      Date.now() >
      consultation.scheduledStartAt.getTime() - cutoff * 60_000
    ) {
      throw new BookingException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'RESCHEDULE_CUTOFF_PASSED',
        'Reschedule deadline has passed',
      );
    }
  }

  private async loadBookableSlot(id: string, session: ClientSession) {
    this.assertObjectId(id, 'availability slot');
    const slot = await this.slots.findById(id).session(session);
    if (!slot) throw new NotFoundException('Availability slot not found');
    if (slot.status !== AvailabilitySlotStatus.AVAILABLE) {
      this.throwAlreadyBooked();
    }
    return slot;
  }

  private async reserveQuota(
    consultationId: string,
    patientId: string,
    session: ClientSession,
  ) {
    try {
      return await this.usage.reserve({ consultationId, patientId, session });
    } catch (error: unknown) {
      if (
        error instanceof HttpException &&
        [HttpStatus.TOO_MANY_REQUESTS, HttpStatus.CONFLICT].includes(
          error.getStatus(),
        )
      ) {
        throw new BookingException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'QUOTA_EXCEEDED',
          'Active subscription consultation quota is exhausted or unavailable',
        );
      }
      throw error;
    }
  }

  private async prepareQuota(patientId: string) {
    try {
      await this.usage.prepare(patientId);
    } catch {
      throw new BookingException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'SUBSCRIPTION_INACTIVE',
        'Patient has no active subscription cycle available for booking',
      );
    }
  }

  private async assertActivePatient(patientId: string) {
    this.assertObjectId(patientId, 'patient');
    const patient = await this.users.findById(patientId);
    if (
      patient.role !== UserRole.PATIENT ||
      patient.accountStatus !== AccountStatus.ACTIVE
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only an active patient can create a scheduled booking',
      });
    }
  }

  private replay(consultation: ConsultationDocument, requestHash: string) {
    return this.response(this.replayDocument(consultation, requestHash));
  }

  private replayDocument(
    consultation: ConsultationDocument,
    requestHash: string,
  ) {
    if (consultation.scheduledBookingRequestHash !== requestHash) {
      this.throwIdempotencyConflict();
    }
    return consultation;
  }

  private assertNotice(startAt: Date, minNoticeMinutes: number) {
    if (startAt.getTime() < Date.now() + minNoticeMinutes * 60_000) {
      throw new BookingException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'MIN_NOTICE_NOT_MET',
        'Slot no longer meets the configured minimum notice',
        { minNoticeMinutes },
      );
    }
  }

  private assertIdempotencyKey(value?: string): asserts value is string {
    if (!value?.trim() || value.length > 200) {
      throw new BookingException(
        HttpStatus.BAD_REQUEST,
        'IDEMPOTENCY_KEY_REQUIRED',
        'Idempotency-Key header is required',
      );
    }
  }

  private assertObjectId(value: string, label: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BookingException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        `Invalid ${label} ID`,
      );
    }
  }

  private throwAlreadyBooked(): never {
    throw new BookingException(
      HttpStatus.CONFLICT,
      'SLOT_ALREADY_BOOKED',
      'Availability slot is no longer bookable',
    );
  }

  private throwIdempotencyConflict(): never {
    throw new BookingException(
      HttpStatus.CONFLICT,
      'IDEMPOTENCY_CONFLICT',
      'Idempotency-Key was reused with a different request',
    );
  }

  private keyHash(actorId: string, key: string) {
    return createHash('sha256').update(`${actorId}:${key}`).digest('hex');
  }

  private requestHash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private isDuplicateKey(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }

  private response(item: ConsultationDocument, statusCode = 200) {
    const value = item.toObject() as unknown as Record<string, unknown>;
    const {
      _id,
      __v: _version,
      scheduledBookingKey: _bookingKey,
      scheduledBookingRequestHash: _bookingHash,
      lastRescheduleKey: _rescheduleKey,
      lastRescheduleRequestHash: _rescheduleHash,
      ...safe
    } = value;
    void _version;
    void _bookingKey;
    void _bookingHash;
    void _rescheduleKey;
    void _rescheduleHash;
    return { statusCode, data: { id: String(_id), ...safe } };
  }

  private async inTransaction<T>(
    execute: (session: ClientSession) => Promise<T>,
  ) {
    const session = await this.connection.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await execute(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
}
