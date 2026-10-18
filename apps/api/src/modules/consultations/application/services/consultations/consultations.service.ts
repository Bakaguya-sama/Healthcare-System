import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types, type ClientSession } from 'mongoose';
import {
  CONSULTATION_USAGE_PORT,
  type ConsultationUsagePort,
} from '../../../../billing/public-api';
import {
  Consultation,
  ConsultationDocument,
  ConsultationMode,
  ConsultationRequestStatus,
  ConsultationSessionStatus,
} from '../../../domain/entities/consultations/consultation.entity';
import { CreateConsultationDto } from '../../../presentation/dto/consultations/create-consultation.dto';
import { UpdateConsultationDto } from '../../../presentation/dto/consultations/update-consultation.dto';
import { QueryConsultationDto } from '../../../presentation/dto/consultations/query-consultation.dto';
import {
  NotificationsService,
  NotificationType,
} from '../../../../notifications/public-api';
import { UsersService } from '../../../../users/public-api';
import type { CareReportPort } from '../../ports/care-report.port';
import { defaultBookingSettingsSnapshot } from './booking-policy';

const CONSULTATION_PROJECTION =
  '_id patientId doctorId patientCareProgramId careAlertId availabilitySlotId mode requestStatus sessionStatus requestedAt respondedAt scheduledStartAt scheduledEndAt timezone expectedDurationMinutes estimatedWaitMinutes overtimeStartedAt patientNotes doctorNotes followUpAt followUp queueJoinedAt queuePriorityAt calledAt sessionStartedAt interruptedAt interruptionReason resumedAt completedAt noShowAt cancelledAt cancellationReason roomId createdAt updatedAt';

@Injectable()
export class ConsultationsService implements CareReportPort {
  constructor(
    @InjectModel(Consultation.name)
    private readonly consultationModel: Model<ConsultationDocument>,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
    @Inject(CONSULTATION_USAGE_PORT)
    private readonly usage: ConsultationUsagePort,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async listForCareReport(input: {
    patientCareProgramId: string;
    patientId: string;
    from: Date;
    to: Date;
    updatedUntil: Date;
    limit: number;
  }) {
    if (
      !Types.ObjectId.isValid(input.patientCareProgramId) ||
      !Types.ObjectId.isValid(input.patientId)
    )
      return { items: [], truncated: false };
    const limit = Math.max(1, Math.min(1_000, Math.floor(input.limit)));
    const rows = await this.consultationModel
      .find({
        patientCareProgramId: new Types.ObjectId(input.patientCareProgramId),
        patientId: new Types.ObjectId(input.patientId),
        requestedAt: { $gte: input.from, $lt: input.to },
        updatedAt: { $lte: input.updatedUntil },
      })
      .select(
        '_id careAlertId sessionStatus requestedAt completedAt followUpAt',
      )
      .sort({ requestedAt: 1, _id: 1 })
      .limit(limit + 1)
      .lean()
      .exec();
    return {
      items: rows.slice(0, limit).map((row) => ({
        id: String(row._id),
        ...(row.careAlertId ? { careAlertId: String(row.careAlertId) } : {}),
        sessionStatus: row.sessionStatus,
        requestedAt: row.requestedAt,
        ...(row.completedAt ? { completedAt: row.completedAt } : {}),
        ...(row.followUpAt ? { followUpAt: row.followUpAt } : {}),
      })),
      truncated: rows.length > limit,
    };
  }

  async create(patientId: string, dto: CreateConsultationDto) {
    this.assertId(patientId, 'patient');
    this.assertId(dto.doctorId, 'doctor');
    const scheduledStartAt = dto.scheduledStartAt
      ? new Date(dto.scheduledStartAt)
      : undefined;
    if (scheduledStartAt && scheduledStartAt < new Date())
      throw new BadRequestException('Cannot schedule consultation in the past');
    const expectedDurationMinutes = dto.expectedDurationMinutes ?? 30;
    const consultation = await this.consultationModel.create({
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(dto.doctorId),
      mode: scheduledStartAt
        ? ConsultationMode.SCHEDULED
        : ConsultationMode.ON_DEMAND,
      requestStatus: ConsultationRequestStatus.PENDING,
      sessionStatus: ConsultationSessionStatus.NOT_STARTED,
      requestedAt: new Date(),
      scheduledStartAt,
      ...(scheduledStartAt
        ? {
            scheduledEndAt: new Date(
              scheduledStartAt.getTime() + expectedDurationMinutes * 60_000,
            ),
          }
        : {}),
      timezone: dto.timezone,
      expectedDurationMinutes,
      patientNotes: dto.patientNotes,
    });
    const patient = await this.users.findById(patientId);
    await this.notifications.create(dto.doctorId, {
      userId: dto.doctorId,
      type: NotificationType.INFO,
      title: 'Consultation request',
      message: `New consultation request from ${patient.fullName}. Note: ${dto.patientNotes ?? ''}.`,
    });
    return this.response(
      'Consultation request created successfully',
      consultation,
      201,
    );
  }

  async findAll(userId: string, userRole: string, query: QueryConsultationDto) {
    this.assertId(userId, 'user');
    const filter: Record<string, unknown> =
      userRole === 'doctor'
        ? { doctorId: new Types.ObjectId(userId) }
        : { patientId: new Types.ObjectId(userId) };
    if (query.mode) filter.mode = query.mode;
    if (query.requestStatus) filter.requestStatus = query.requestStatus;
    if (query.sessionStatus) filter.sessionStatus = query.sessionStatus;
    if (query.doctorId && userRole !== 'doctor')
      filter.doctorId = new Types.ObjectId(query.doctorId);
    if (query.patientId && userRole !== 'patient')
      filter.patientId = new Types.ObjectId(query.patientId);
    if (query.from || query.to)
      filter.scheduledStartAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    const sort = {
      [query.sortBy]: query.sortOrder,
      _id: query.sortOrder ?? -1,
    };
    const [items, total] = await Promise.all([
      this.consultationModel
        .find(filter)
        .select(CONSULTATION_PROJECTION)
        .populate('patientId', 'fullName email phoneNumber avatarUrl')
        .populate(
          'doctorId',
          'fullName email phoneNumber avatarUrl doctorProfile',
        )
        .sort(sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean()
        .exec(),
      this.consultationModel.countDocuments(filter),
    ]);
    return {
      statusCode: 200,
      message: 'Consultations retrieved successfully',
      data: items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const consultation = await this.load(id);
    this.assertParticipant(consultation, userId);
    return this.response('Consultation retrieved successfully', consultation);
  }

  async update(userId: string, id: string, dto: UpdateConsultationDto) {
    const consultation = await this.inTransaction(async (session) => {
      const consultation = await this.load(id, session);
      this.assertParticipant(consultation, userId);
      if (
        [ConsultationSessionStatus.COMPLETED].includes(
          consultation.sessionStatus,
        )
      )
        throw new BadRequestException(
          'Cannot update completed or cancelled consultation',
        );
      if (dto.patientNotes !== undefined)
        consultation.patientNotes = dto.patientNotes;
      if (dto.doctorNotes !== undefined)
        consultation.doctorNotes = dto.doctorNotes;
      if (dto.scheduledStartAt) {
        if (consultation.requestStatus !== ConsultationRequestStatus.PENDING)
          throw new BadRequestException(
            'Cannot reschedule a confirmed consultation',
          );
        const scheduledStartAt = new Date(dto.scheduledStartAt);
        if (scheduledStartAt < new Date())
          throw new BadRequestException(
            'Cannot schedule consultation in the past',
          );
        consultation.scheduledStartAt = scheduledStartAt;
        consultation.mode = ConsultationMode.SCHEDULED;
        consultation.scheduledEndAt = new Date(
          scheduledStartAt.getTime() +
            (consultation.expectedDurationMinutes ?? 30) * 60_000,
        );
      }
      await consultation.save({ session });
      return consultation;
    });
    return this.response('Consultation updated successfully', consultation);
  }

  async accept(userId: string, id: string) {
    return this.transitionDoctor(
      userId,
      id,
      ConsultationRequestStatus.ACCEPTED,
      'Consultation accepted successfully',
    );
  }
  async decline(userId: string, id: string, reason?: string) {
    return this.transitionDoctor(
      userId,
      id,
      ConsultationRequestStatus.DECLINED,
      'Consultation declined successfully',
      reason,
    );
  }

  private async transitionDoctor(
    userId: string,
    id: string,
    status: ConsultationRequestStatus,
    message: string,
    reason?: string,
  ) {
    const initial = await this.load(id);
    if (!this.same(initial.doctorId, userId))
      throw new ForbiddenException(
        'Only doctor can change the consultation request',
      );
    if (initial.requestStatus !== ConsultationRequestStatus.PENDING)
      throw new BadRequestException('Consultation request is not pending');
    if (status === ConsultationRequestStatus.ACCEPTED)
      await this.usage.prepare(String(initial.patientId));
    const consultation = await this.inTransaction(async (session) => {
      const consultation = await this.load(id, session);
      if (!this.same(consultation.doctorId, userId))
        throw new ForbiddenException(
          'Only doctor can change the consultation request',
        );
      if (consultation.requestStatus !== ConsultationRequestStatus.PENDING)
        throw new BadRequestException('Consultation request is not pending');
      consultation.requestStatus = status;
      consultation.respondedAt = new Date();
      consultation.declinedReason = reason;
      if (status === ConsultationRequestStatus.ACCEPTED) {
        if (consultation.mode === ConsultationMode.SCHEDULED)
          consultation.bookingSettingsSnapshot =
            defaultBookingSettingsSnapshot();
        const reservation = await this.usage.reserve({
          consultationId: String(consultation._id),
          patientId: String(consultation.patientId),
          session,
        });
        if (reservation.status !== 'reserved')
          throw new BadRequestException('Consultation quota is not reserved');
        consultation.sessionStatus = ConsultationSessionStatus.WAITING;
      }
      await consultation.save({ session });
      return consultation;
    });
    await this.notifications.create(consultation.patientId.toString(), {
      userId: consultation.patientId.toString(),
      type: NotificationType.INFO,
      title:
        status === ConsultationRequestStatus.ACCEPTED
          ? 'Consultation accepted'
          : 'Consultation declined',
      message,
    });
    return this.response(message, consultation);
  }

  async start(userId: string, id: string) {
    const consultation = await this.inTransaction(async (session) => {
      const consultation = await this.load(id, session);
      if (!this.same(consultation.doctorId, userId))
        throw new ForbiddenException('Only doctor can start consultation');
      if (
        consultation.requestStatus !== ConsultationRequestStatus.ACCEPTED ||
        consultation.sessionStatus !== ConsultationSessionStatus.WAITING
      )
        throw new BadRequestException(
          'Consultation must be accepted before starting',
        );
      if (!consultation.legacyQuotaExempt) {
        const status = await this.usage.count({
          consultationId: String(consultation._id),
          session,
        });
        if (status !== 'counted')
          throw new BadRequestException('Consultation quota cannot be counted');
      }
      consultation.sessionStatus = ConsultationSessionStatus.IN_CONSULTATION;
      consultation.sessionStartedAt = new Date();
      await consultation.save({ session });
      return consultation;
    });
    return this.response('Consultation started successfully', consultation);
  }

  async complete(userId: string, id: string, dto: UpdateConsultationDto) {
    const consultation = await this.load(id);
    if (!this.same(consultation.doctorId, userId))
      throw new ForbiddenException('Only doctor can complete consultation');
    if (
      consultation.sessionStatus !== ConsultationSessionStatus.IN_CONSULTATION
    )
      throw new BadRequestException('Consultation is not in progress');
    consultation.sessionStatus = ConsultationSessionStatus.COMPLETED;
    consultation.completedAt = new Date();
    consultation.completedBy = new Types.ObjectId(userId);
    consultation.doctorNotes = dto.doctorNotes;
    await consultation.save();
    return this.response('Consultation completed successfully', consultation);
  }

  async markNoShow(userId: string, id: string, reason?: string) {
    const consultation = await this.inTransaction(async (session) => {
      const consultation = await this.load(id, session);
      if (!this.same(consultation.doctorId, userId))
        throw new ForbiddenException('Only doctor can mark a no-show');
      if (
        consultation.requestStatus !== ConsultationRequestStatus.ACCEPTED ||
        consultation.sessionStatus !== ConsultationSessionStatus.WAITING
      )
        throw new BadRequestException(
          'Consultation must be waiting to mark no-show',
        );
      const minutes = consultation.bookingSettingsSnapshot?.noShowAfterMinutes;
      if (
        consultation.mode !== ConsultationMode.SCHEDULED ||
        !consultation.scheduledStartAt ||
        typeof minutes !== 'number' ||
        !Number.isFinite(minutes) ||
        minutes < 0
      )
        throw new BadRequestException('No-show policy is unavailable');
      if (
        Date.now() <
        consultation.scheduledStartAt.getTime() + minutes * 60_000
      )
        throw new BadRequestException('No-show waiting period has not elapsed');
      if (!consultation.legacyQuotaExempt) {
        const status = await this.usage.count({
          consultationId: String(consultation._id),
          session,
        });
        if (status !== 'counted')
          throw new BadRequestException('Consultation quota cannot be counted');
      }
      consultation.sessionStatus = ConsultationSessionStatus.NO_SHOW;
      consultation.noShowAt = new Date();
      consultation.noShowReason = reason;
      await consultation.save({ session });
      return consultation;
    });
    return this.response('Consultation marked as no-show', consultation);
  }

  async cancel(userId: string, id: string, dto: UpdateConsultationDto) {
    const consultation = await this.inTransaction(async (session) => {
      const consultation = await this.load(id, session);
      this.assertParticipant(consultation, userId);
      if (
        [
          ConsultationSessionStatus.COMPLETED,
          ConsultationSessionStatus.NO_SHOW,
        ].includes(consultation.sessionStatus) ||
        consultation.requestStatus === ConsultationRequestStatus.CANCELLED
      )
        throw new BadRequestException('Cannot cancel a terminal consultation');
      if (
        this.same(consultation.patientId, userId) &&
        consultation.requestStatus === ConsultationRequestStatus.ACCEPTED &&
        consultation.mode === ConsultationMode.SCHEDULED &&
        consultation.sessionStatus === ConsultationSessionStatus.WAITING
      ) {
        const minutes =
          consultation.bookingSettingsSnapshot?.cancellationDeadlineMinutes;
        if (
          !consultation.scheduledStartAt ||
          typeof minutes !== 'number' ||
          !Number.isFinite(minutes) ||
          minutes < 0
        )
          throw new BadRequestException('Cancellation policy is unavailable');
        if (
          Date.now() >
          consultation.scheduledStartAt.getTime() - minutes * 60_000
        )
          throw new BadRequestException('Cancellation deadline has passed');
      }
      if (
        consultation.requestStatus === ConsultationRequestStatus.ACCEPTED &&
        consultation.sessionStatus === ConsultationSessionStatus.WAITING &&
        !consultation.legacyQuotaExempt
      ) {
        const status = await this.usage.release({
          consultationId: String(consultation._id),
          reason: 'cancelled',
          session,
        });
        if (status !== 'released')
          throw new BadRequestException(
            'Consultation quota cannot be released',
          );
      }
      consultation.requestStatus = ConsultationRequestStatus.CANCELLED;
      // Cancellation is expressed by requestStatus. Preserve that a live call
      // was interrupted instead of inventing the retired `cancelled` session
      // state; a request cancelled before start remains `not_started`.
      if (
        consultation.sessionStatus === ConsultationSessionStatus.IN_CONSULTATION
      ) {
        consultation.sessionStatus = ConsultationSessionStatus.INTERRUPTED;
        consultation.interruptedAt = new Date();
        consultation.interruptionReason = 'cancelled';
      } else {
        consultation.sessionStatus = ConsultationSessionStatus.NOT_STARTED;
      }
      consultation.cancelledAt = new Date();
      consultation.cancelledBy = new Types.ObjectId(userId);
      consultation.cancellationReason = dto.reason;
      await consultation.save({ session });
      return consultation;
    });
    return this.response('Consultation cancelled successfully', consultation);
  }

  async reconcileReservedUsage(id: string) {
    return this.inTransaction(async (session) => {
      if (!Types.ObjectId.isValid(id))
        throw new BadRequestException('Invalid consultation ID');
      const consultation = await this.consultationModel
        .findById(id)
        .session(session);
      if (!consultation) return 'missing_consultation' as const;
      if (
        [
          ConsultationSessionStatus.IN_CONSULTATION,
          ConsultationSessionStatus.COMPLETED,
          ConsultationSessionStatus.NO_SHOW,
          ConsultationSessionStatus.INTERRUPTED,
        ].includes(consultation.sessionStatus)
      ) {
        const status = await this.usage.count({ consultationId: id, session });
        return status === 'counted'
          ? ('counted' as const)
          : ('conflict' as const);
      }
      if (
        consultation.requestStatus === ConsultationRequestStatus.CANCELLED ||
        consultation.requestStatus === ConsultationRequestStatus.DECLINED
      ) {
        const status = await this.usage.release({
          consultationId: id,
          reason:
            consultation.requestStatus === ConsultationRequestStatus.DECLINED
              ? 'declined'
              : 'cancelled',
          session,
        });
        return status === 'released'
          ? ('released' as const)
          : ('conflict' as const);
      }
      return consultation.requestStatus ===
        ConsultationRequestStatus.ACCEPTED &&
        consultation.sessionStatus === ConsultationSessionStatus.WAITING
        ? ('unchanged' as const)
        : ('conflict' as const);
    });
  }

  async getUpcoming(userId: string, userRole: string, days = 7) {
    this.assertId(userId, 'user');
    const actor =
      userRole === 'doctor'
        ? { doctorId: new Types.ObjectId(userId) }
        : { patientId: new Types.ObjectId(userId) };
    const items = await this.consultationModel
      .find({
        ...actor,
        requestStatus: ConsultationRequestStatus.ACCEPTED,
        sessionStatus: {
          $in: [
            ConsultationSessionStatus.WAITING,
            ConsultationSessionStatus.IN_CONSULTATION,
          ],
        },
        scheduledStartAt: {
          $gte: new Date(),
          $lte: new Date(
            Date.now() + Math.min(31, Math.max(1, days)) * 86400000,
          ),
        },
      })
      .select(CONSULTATION_PROJECTION)
      .sort({ scheduledStartAt: 1, _id: 1 })
      .limit(100)
      .lean()
      .exec();
    return {
      statusCode: 200,
      message: 'Upcoming consultations retrieved successfully',
      data: items,
      count: items.length,
    };
  }

  async findAccessible(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(userId))
      return null;
    return this.consultationModel.findOne({
      _id: new Types.ObjectId(id),
      $or: [
        { patientId: new Types.ObjectId(userId) },
        { doctorId: new Types.ObjectId(userId) },
      ],
    });
  }

  async findForReview(id: string, patientId: string, doctorId: string) {
    if (
      !Types.ObjectId.isValid(id) ||
      !Types.ObjectId.isValid(patientId) ||
      !Types.ObjectId.isValid(doctorId)
    )
      return null;
    return this.consultationModel.findOne({
      _id: new Types.ObjectId(id),
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(doctorId),
    });
  }

  async findDocument(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.consultationModel.findById(new Types.ObjectId(id));
  }

  async recordLastMessage(id: string, messageId: string, sentAt: Date) {
    await this.consultationModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { lastMessageId: messageId, lastMessageAt: sentAt } },
    );
  }

  async findAllForAdmin(query: QueryConsultationDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const filter: Record<string, any> = {};
    if (query.doctorId) filter.doctorId = new Types.ObjectId(query.doctorId);
    if (query.patientId) filter.patientId = new Types.ObjectId(query.patientId);
    if (query.mode) filter.mode = query.mode;
    if (query.requestStatus) filter.requestStatus = query.requestStatus;
    if (query.sessionStatus) filter.sessionStatus = query.sessionStatus;
    if (query.from || query.to)
      filter.scheduledStartAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    const [items, total] = await Promise.all([
      this.consultationModel
        .find(filter)
        .select(CONSULTATION_PROJECTION)
        .populate('patientId', 'fullName email phoneNumber')
        .populate('doctorId', 'fullName email doctorProfile')
        .sort({ [query.sortBy]: query.sortOrder, _id: query.sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.consultationModel.countDocuments(filter),
    ]);
    return {
      data: items,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOneForAdmin(id: string) {
    this.assertId(id, 'consultation');
    const item = await this.consultationModel
      .findById(id)
      .select(CONSULTATION_PROJECTION)
      .populate('patientId', 'fullName email phoneNumber')
      .populate('doctorId', 'fullName email doctorProfile')
      .lean()
      .exec();
    if (!item) throw new NotFoundException('Consultation not found');
    return item;
  }

  countAll() {
    return this.consultationModel.countDocuments();
  }

  private async load(
    id: string,
    session?: ClientSession,
  ): Promise<ConsultationDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid consultation ID');
    const query = this.consultationModel.findById(id);
    const item = await (session ? query.session(session) : query);
    if (!item) throw new NotFoundException('Consultation not found');
    return item;
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
  private assertId(id: string, label: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException(`Invalid ${label} ID`);
  }
  private same(value: Types.ObjectId, id: string) {
    return Types.ObjectId.isValid(id) && value.equals(new Types.ObjectId(id));
  }
  private assertParticipant(item: ConsultationDocument, userId: string) {
    if (!this.same(item.patientId, userId) && !this.same(item.doctorId, userId))
      throw new ForbiddenException(
        'You are not authorized to access this consultation',
      );
  }
  private response(
    message: string,
    item: ConsultationDocument | Record<string, any>,
    statusCode = 200,
  ) {
    return { statusCode, message, data: this.serialize(item) };
  }
  private serialize(item: ConsultationDocument | Record<string, any>) {
    return typeof (item as any).toObject === 'function'
      ? (item as any).toObject()
      : item;
  }
}
