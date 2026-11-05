import { createHash } from 'node:crypto';
import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types, mongo } from 'mongoose';
import {
  AccountStatus,
  DoctorVerificationStatus,
  UserRole,
} from '../../../../../core/domain/user.enums';
import { UsersService } from '../../../../users/public-api';
import { BookingException } from '../../errors/booking.exception';
import {
  Consultation,
  ConsultationDocument,
  ConsultationMode,
  ConsultationRequestStatus,
  ConsultationSessionStatus,
} from '../../../domain/entities/consultations/consultation.entity';
import { PageQueryDto } from '../../../../../common/pagination';
import { BookingPolicyService } from './booking-policy';

const QUEUE_PROJECTION =
  '_id patientId doctorId mode requestStatus sessionStatus scheduledStartAt expectedDurationMinutes queueJoinedAt queuePriorityAt calledAt sessionStartedAt updatedAt';

type QueueStatus = 'waiting' | 'called';

type QueueLeanItem = {
  _id: Types.ObjectId;
  patientId:
    | Types.ObjectId
    | { _id: Types.ObjectId; fullName?: string; avatarUrl?: string };
  doctorId: Types.ObjectId;
  mode: ConsultationMode;
  requestStatus: ConsultationRequestStatus;
  sessionStatus: ConsultationSessionStatus;
  scheduledStartAt: Date;
  expectedDurationMinutes: number;
  queueJoinedAt: Date;
  queuePriorityAt: Date;
  calledAt?: Date;
  sessionStartedAt?: Date;
  updatedAt: Date;
};

@Injectable()
export class ConsultationQueueService {
  constructor(
    @InjectModel(Consultation.name)
    private readonly consultations: Model<ConsultationDocument>,
    private readonly users: UsersService,
    private readonly policy: BookingPolicyService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async checkIn(
    patientId: string,
    consultationId: string,
    idempotencyKey: string | undefined,
  ) {
    this.assertObjectId(patientId, 'patient');
    this.assertObjectId(consultationId, 'consultation');
    this.assertIdempotencyKey(idempotencyKey);
    await this.assertActivePatient(patientId);

    const key = this.hash(
      `check-in:${patientId}:${consultationId}:${idempotencyKey}`,
    );
    const requestHash = this.hash(consultationId);
    const current = await this.consultations.findById(consultationId);
    if (!current) throw new NotFoundException('Consultation not found');
    this.assertPatientOwner(current, patientId);

    if (current.checkInKey === key) {
      if (current.checkInRequestHash !== requestHash) {
        this.throwIdempotencyConflict();
      }
      return this.checkInResponse(current, patientId, true);
    }
    if (
      current.sessionStatus === ConsultationSessionStatus.WAITING &&
      current.queueJoinedAt &&
      current.queuePriorityAt
    ) {
      return this.checkInResponse(current, patientId, true);
    }

    this.assertCheckInState(current);
    const now = new Date();
    this.assertCheckInWindow(current, now);

    const checkedIn = await this.consultations.findOneAndUpdate(
      {
        _id: current._id,
        patientId: new Types.ObjectId(patientId),
        mode: ConsultationMode.SCHEDULED,
        requestStatus: ConsultationRequestStatus.ACCEPTED,
        sessionStatus: ConsultationSessionStatus.NOT_STARTED,
      },
      {
        $set: {
          sessionStatus: ConsultationSessionStatus.WAITING,
          queueJoinedAt: now,
          queuePriorityAt: current.scheduledStartAt,
          checkInKey: key,
          checkInRequestHash: requestHash,
        },
      },
      { returnDocument: 'after' },
    );
    if (checkedIn) return this.checkInResponse(checkedIn, patientId, false);

    const concurrent = await this.consultations.findById(consultationId);
    if (
      concurrent?.patientId.equals(new Types.ObjectId(patientId)) &&
      concurrent.sessionStatus === ConsultationSessionStatus.WAITING &&
      concurrent.queueJoinedAt &&
      concurrent.queuePriorityAt
    ) {
      return this.checkInResponse(concurrent, patientId, true);
    }
    throw new BookingException(
      HttpStatus.CONFLICT,
      'CHECK_IN_STATE_CONFLICT',
      'Consultation state changed before check-in completed',
    );
  }

  async getPatientQueue(patientId: string, consultationId: string) {
    this.assertObjectId(patientId, 'patient');
    this.assertObjectId(consultationId, 'consultation');
    const item = await this.consultations
      .findById(consultationId)
      .select(QUEUE_PROJECTION)
      .lean()
      .exec();
    if (!item) throw new NotFoundException('Consultation not found');
    if (!item.patientId.equals(new Types.ObjectId(patientId))) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Patient does not own this consultation',
      });
    }
    const queueItem = item as unknown as QueueLeanItem;
    this.assertInQueue(queueItem);
    return this.patientSnapshot(queueItem);
  }

  async listDoctorQueue(doctorId: string, query: PageQueryDto) {
    await this.assertApprovedDoctor(doctorId);
    const filter = this.queueFilter(doctorId);
    const [items, total, currentSession] = await Promise.all([
      this.consultations
        .find(filter)
        .select(QUEUE_PROJECTION)
        .populate('patientId', 'fullName avatarUrl')
        .sort({ queuePriorityAt: 1, queueJoinedAt: 1, _id: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean()
        .exec(),
      this.consultations.countDocuments(filter),
      this.consultations
        .findOne({
          doctorId: new Types.ObjectId(doctorId),
          sessionStatus: ConsultationSessionStatus.IN_CONSULTATION,
        })
        .select(QUEUE_PROJECTION)
        .lean()
        .exec(),
    ]);

    return {
      data: items.map((item, index) =>
        this.doctorEntry(
          item as unknown as QueueLeanItem,
          (query.page - 1) * query.limit + index + 1,
        ),
      ),
      currentSession: currentSession
        ? this.currentSession(currentSession as unknown as QueueLeanItem)
        : null,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  async callNext(doctorId: string, idempotencyKey: string | undefined) {
    this.assertObjectId(doctorId, 'doctor');
    this.assertIdempotencyKey(idempotencyKey);
    await this.assertApprovedDoctor(doctorId);
    const key = this.hash(`call-next:${doctorId}:${idempotencyKey}`);
    const requestHash = this.hash('call-next');

    const replay = await this.consultations.findOne({ lastCallNextKey: key });
    if (replay) return this.callNextReplay(replay, requestHash);

    try {
      const claimed = await this.inTransaction(async (session) => {
        const insideReplay = await this.consultations
          .findOne({ lastCallNextKey: key })
          .session(session);
        if (insideReplay)
          return this.callNextReplayDocument(insideReplay, requestHash);

        const active = await this.consultations
          .findOne({
            doctorId: new Types.ObjectId(doctorId),
            sessionStatus: ConsultationSessionStatus.IN_CONSULTATION,
          })
          .session(session)
          .select('_id')
          .lean()
          .exec();
        if (active) {
          throw new BookingException(
            HttpStatus.CONFLICT,
            'DOCTOR_ACTIVE_SESSION_CONFLICT',
            'Doctor already has an active consultation',
            { consultationId: String(active._id) },
          );
        }

        const alreadyCalled = await this.findCalled(doctorId, session);
        if (alreadyCalled) {
          throw new BookingException(
            HttpStatus.CONFLICT,
            'DOCTOR_QUEUE_ITEM_ALREADY_CALLED',
            'Doctor already has a called consultation awaiting start',
            { consultationId: String(alreadyCalled._id) },
          );
        }

        const head = await this.consultations
          .findOne(this.queueFilter(doctorId))
          .session(session)
          .sort({ queuePriorityAt: 1, queueJoinedAt: 1, _id: 1 });
        if (!head) {
          throw new BookingException(
            HttpStatus.CONFLICT,
            'QUEUE_EMPTY',
            'Doctor queue has no eligible consultation',
          );
        }

        const calledAt = new Date();
        const updated = await this.consultations.findOneAndUpdate(
          {
            _id: head._id,
            requestStatus: ConsultationRequestStatus.ACCEPTED,
            sessionStatus: ConsultationSessionStatus.WAITING,
            calledAt: { $exists: false },
          },
          {
            $set: {
              calledAt,
              lastCallNextKey: key,
              lastCallNextRequestHash: requestHash,
            },
          },
          { returnDocument: 'after', session },
        );
        if (!updated) {
          throw new BookingException(
            HttpStatus.CONFLICT,
            'QUEUE_STATE_CONFLICT',
            'Queue head changed before it could be called',
          );
        }
        return updated;
      });
      return this.callNextResponse(claimed, false);
    } catch (error: unknown) {
      if (this.isDuplicateKey(error)) {
        const concurrentReplay = await this.consultations.findOne({
          lastCallNextKey: key,
        });
        if (concurrentReplay) {
          return this.callNextReplay(concurrentReplay, requestHash);
        }
        const called = await this.findCalled(doctorId);
        throw new BookingException(
          HttpStatus.CONFLICT,
          'DOCTOR_QUEUE_ITEM_ALREADY_CALLED',
          'A concurrent request already called a consultation',
          called ? { consultationId: String(called._id) } : undefined,
        );
      }
      throw error;
    }
  }

  private async checkInResponse(
    consultation: ConsultationDocument,
    patientId: string,
    replayed: boolean,
  ) {
    const queue = await this.getPatientQueue(
      patientId,
      String(consultation._id),
    );
    return {
      data: this.consultationState(consultation),
      queue,
      replayed,
    };
  }

  private async patientSnapshot(item: QueueLeanItem) {
    const position = await this.consultations.countDocuments({
      ...this.queueFilter(String(item.doctorId)),
      $or: [
        { queuePriorityAt: { $lt: item.queuePriorityAt } },
        {
          queuePriorityAt: item.queuePriorityAt,
          queueJoinedAt: { $lt: item.queueJoinedAt },
        },
        {
          queuePriorityAt: item.queuePriorityAt,
          queueJoinedAt: item.queueJoinedAt,
          _id: { $lt: item._id },
        },
      ],
    });
    return {
      consultationId: String(item._id),
      status: (item.calledAt ? 'called' : 'waiting') as QueueStatus,
      position: position + 1,
      estimatedWaitMinutes: null,
      etaReason: 'ETA_POLICY_NOT_CONFIGURED',
      updatedAt: item.updatedAt,
    };
  }

  private doctorEntry(item: QueueLeanItem, position: number) {
    const patientValue = item.patientId;
    const patient =
      patientValue instanceof Types.ObjectId
        ? { id: String(patientValue) }
        : {
            id: String(patientValue._id),
            fullName: patientValue.fullName,
            avatarUrl: patientValue.avatarUrl,
          };
    const scheduledStartAt = item.scheduledStartAt;
    return {
      consultationId: String(item._id),
      patient,
      mode: item.mode,
      scheduledStartAt,
      queueJoinedAt: item.queueJoinedAt,
      queuePosition: position,
      estimatedWaitMinutes: null,
      etaReason: 'ETA_POLICY_NOT_CONFIGURED',
      isCurrent: item.calledAt instanceof Date,
      isLate: scheduledStartAt.getTime() < Date.now(),
      calledAt: item.calledAt,
    };
  }

  private currentSession(item: QueueLeanItem) {
    const patientId =
      item.patientId instanceof Types.ObjectId
        ? item.patientId
        : item.patientId._id;
    return {
      consultationId: String(item._id),
      patientId: String(patientId),
      sessionStatus: item.sessionStatus,
      sessionStartedAt: item.sessionStartedAt,
    };
  }

  private callNextResponse(
    consultation: ConsultationDocument,
    replayed: boolean,
  ) {
    return { data: this.consultationState(consultation), replayed };
  }

  private callNextReplay(
    consultation: ConsultationDocument,
    requestHash: string,
  ) {
    return this.callNextResponse(
      this.callNextReplayDocument(consultation, requestHash),
      true,
    );
  }

  private callNextReplayDocument(
    consultation: ConsultationDocument,
    requestHash: string,
  ) {
    if (consultation.lastCallNextRequestHash !== requestHash) {
      this.throwIdempotencyConflict();
    }
    return consultation;
  }

  private consultationState(consultation: ConsultationDocument) {
    return {
      id: String(consultation._id),
      patientId: String(consultation.patientId),
      doctorId: String(consultation.doctorId),
      requestStatus: consultation.requestStatus,
      sessionStatus: consultation.sessionStatus,
      scheduledStartAt: consultation.scheduledStartAt,
      queueJoinedAt: consultation.queueJoinedAt,
      queuePriorityAt: consultation.queuePriorityAt,
      calledAt: consultation.calledAt,
      updatedAt: (consultation as ConsultationDocument & { updatedAt: Date })
        .updatedAt,
    };
  }

  private assertCheckInState(consultation: ConsultationDocument) {
    if (
      consultation.mode !== ConsultationMode.SCHEDULED ||
      consultation.requestStatus !== ConsultationRequestStatus.ACCEPTED ||
      consultation.sessionStatus !== ConsultationSessionStatus.NOT_STARTED ||
      !consultation.scheduledStartAt
    ) {
      throw new BookingException(
        HttpStatus.CONFLICT,
        'CHECK_IN_INVALID_STATE',
        'Only an accepted scheduled consultation that has not started can check in',
      );
    }
  }

  private assertCheckInWindow(consultation: ConsultationDocument, now: Date) {
    const snapshot = consultation.bookingSettingsSnapshot;
    const snapshotEarly = snapshot?.checkInEarlyMinutes;
    const checkInEarlyMinutes =
      typeof snapshotEarly === 'number'
        ? snapshotEarly
        : this.policy.getCheckInEarlyMinutes();
    const noShowAfterMinutes = snapshot?.noShowAfterMinutes;
    if (
      typeof noShowAfterMinutes !== 'number' ||
      !consultation.scheduledStartAt
    ) {
      throw new BookingException(
        HttpStatus.CONFLICT,
        'BOOKING_POLICY_UNAVAILABLE',
        'Check-in requires a no-show policy snapshot',
      );
    }
    const opensAt = new Date(
      consultation.scheduledStartAt.getTime() - checkInEarlyMinutes * 60_000,
    );
    const closesAt = new Date(
      consultation.scheduledStartAt.getTime() + noShowAfterMinutes * 60_000,
    );
    if (now < opensAt) {
      throw new BookingException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CHECK_IN_TOO_EARLY',
        'Check-in window has not opened',
        { opensAt, checkInEarlyMinutes },
      );
    }
    if (now > closesAt) {
      throw new BookingException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CHECK_IN_WINDOW_CLOSED',
        'Check-in window has closed',
        { closesAt, noShowAfterMinutes },
      );
    }
  }

  private assertInQueue(item: Partial<QueueLeanItem>) {
    if (
      item.mode !== ConsultationMode.SCHEDULED ||
      item.requestStatus !== ConsultationRequestStatus.ACCEPTED ||
      item.sessionStatus !== ConsultationSessionStatus.WAITING ||
      !item.queueJoinedAt ||
      !item.queuePriorityAt
    ) {
      throw new BookingException(
        HttpStatus.CONFLICT,
        'CONSULTATION_NOT_IN_QUEUE',
        'Consultation is not currently waiting in the queue',
      );
    }
  }

  private queueFilter(doctorId: string) {
    return {
      doctorId: new Types.ObjectId(doctorId),
      mode: ConsultationMode.SCHEDULED,
      requestStatus: ConsultationRequestStatus.ACCEPTED,
      sessionStatus: ConsultationSessionStatus.WAITING,
      queueJoinedAt: { $type: 'date' as const },
      queuePriorityAt: { $type: 'date' as const },
    };
  }

  private async findCalled(doctorId: string, session?: ClientSession) {
    const query = this.consultations.findOne({
      ...this.queueFilter(doctorId),
      calledAt: { $type: 'date' },
    });
    if (session) query.session(session);
    return query;
  }

  private async assertActivePatient(patientId: string) {
    const patient = await this.users.findById(patientId);
    if (
      patient.role !== UserRole.PATIENT ||
      patient.accountStatus !== AccountStatus.ACTIVE
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only an active patient can check in',
      });
    }
  }

  private async assertApprovedDoctor(doctorId: string) {
    this.assertObjectId(doctorId, 'doctor');
    const doctor = await this.users.findById(doctorId);
    if (
      doctor.role !== UserRole.DOCTOR ||
      doctor.accountStatus !== AccountStatus.ACTIVE ||
      doctor.doctorProfile?.verificationStatus !==
        DoctorVerificationStatus.APPROVED
    ) {
      throw new ForbiddenException({
        code: 'DOCTOR_NOT_APPROVED',
        message: 'Only an active approved doctor can use the queue',
      });
    }
  }

  private assertPatientOwner(
    consultation: ConsultationDocument,
    patientId: string,
  ) {
    if (!consultation.patientId.equals(new Types.ObjectId(patientId))) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only the patient owner can check in',
      });
    }
  }

  private assertIdempotencyKey(
    value: string | undefined,
  ): asserts value is string {
    if (!value || value.length > 200) {
      throw new BookingException(
        HttpStatus.BAD_REQUEST,
        'IDEMPOTENCY_KEY_REQUIRED',
        'A valid Idempotency-Key header is required',
      );
    }
  }

  private throwIdempotencyConflict(): never {
    throw new BookingException(
      HttpStatus.CONFLICT,
      'IDEMPOTENCY_CONFLICT',
      'Idempotency-Key was reused for another request',
    );
  }

  private assertObjectId(value: string, label: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BookingException(
        HttpStatus.BAD_REQUEST,
        'INVALID_ID',
        `Invalid ${label} ID`,
      );
    }
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private isDuplicateKey(error: unknown) {
    return error instanceof mongo.MongoServerError && error.code === 11000;
  }

  private async inTransaction<T>(
    execute: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
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
