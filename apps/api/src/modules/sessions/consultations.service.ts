import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Consultation,
  ConsultationDocument,
  ConsultationMode,
  ConsultationRequestStatus,
  ConsultationSessionStatus,
} from './entities/consultation.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { QuerySessionDto } from './dto/query-session.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { UsersService } from '../users/users.service';

const CONSULTATION_PROJECTION =
  '_id patientId doctorId mode requestStatus sessionStatus requestedAt respondedAt scheduledStartAt scheduledEndAt patientNotes doctorNotes sessionStartedAt completedAt cancelledAt cancellationReason lastMessageAt lastMessageId createdAt updatedAt';

@Injectable()
export class ConsultationsService {
  constructor(
    @InjectModel(Consultation.name)
    private readonly consultationModel: Model<ConsultationDocument>,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
  ) {}

  async create(patientId: string, dto: CreateSessionDto) {
    this.assertId(patientId, 'patient');
    this.assertId(dto.doctorId, 'doctor');
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt < new Date())
      throw new BadRequestException('Cannot schedule consultation in the past');
    const consultation = await this.consultationModel.create({
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(dto.doctorId),
      mode: ConsultationMode.ON_DEMAND,
      requestStatus: ConsultationRequestStatus.PENDING,
      sessionStatus: ConsultationSessionStatus.NOT_STARTED,
      requestedAt: new Date(),
      scheduledStartAt: scheduledAt,
      patientNotes: dto.patientNotes,
    });
    const patient = await this.users.findById(patientId);
    await this.notifications.create(dto.doctorId, {
      userId: dto.doctorId,
      type: NotificationType.INFO,
      title: 'Consultation request',
      message: `New consultation request from ${patient.fullName}. Note: ${dto.patientNotes ?? ''}.`,
    });
    return this.legacyResponse(
      'Consultation request created successfully',
      consultation,
      201,
    );
  }

  async findAll(userId: string, userRole: string, query: QuerySessionDto) {
    this.assertId(userId, 'user');
    const filter: Record<string, unknown> =
      userRole === 'doctor'
        ? { doctorId: new Types.ObjectId(userId) }
        : { patientId: new Types.ObjectId(userId) };
    if (query.status) this.applyLegacyStatusFilter(filter, query.status);
    if (query.doctorId && userRole !== 'doctor')
      filter.doctorId = new Types.ObjectId(query.doctorId);
    if (query.patientId && userRole !== 'patient')
      filter.patientId = new Types.ObjectId(query.patientId);
    if (query.startDate || query.endDate)
      filter.scheduledStartAt = {
        ...(query.startDate ? { $gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { $lte: new Date(query.endDate) } : {}),
      };
    const sort = {
      [query.sortBy === 'scheduledAt' ? 'scheduledStartAt' : query.sortBy]:
        query.sortOrder ?? -1,
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
      data: items.map((item) => this.toLegacy(item)),
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
    return this.legacyResponse(
      'Consultation retrieved successfully',
      consultation,
    );
  }

  async update(userId: string, id: string, dto: UpdateSessionDto) {
    const consultation = await this.load(id);
    this.assertParticipant(consultation, userId);
    if (
      [
        ConsultationSessionStatus.COMPLETED,
        ConsultationSessionStatus.CANCELLED,
      ].includes(consultation.sessionStatus)
    )
      throw new BadRequestException(
        'Cannot update completed or cancelled consultation',
      );
    if (dto.patientNotes !== undefined)
      consultation.patientNotes = dto.patientNotes;
    if (dto.doctorNotes !== undefined)
      consultation.doctorNotes = dto.doctorNotes;
    if (dto.scheduledAt)
      consultation.scheduledStartAt = new Date(dto.scheduledAt);
    await consultation.save();
    return this.legacyResponse(
      'Consultation updated successfully',
      consultation,
    );
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
    const consultation = await this.load(id);
    if (!this.same(consultation.doctorId, userId))
      throw new ForbiddenException(
        'Only doctor can change the consultation request',
      );
    if (consultation.requestStatus !== ConsultationRequestStatus.PENDING)
      throw new BadRequestException('Consultation request is not pending');
    consultation.requestStatus = status;
    consultation.respondedAt = new Date();
    consultation.declinedReason = reason;
    if (status === ConsultationRequestStatus.ACCEPTED)
      consultation.sessionStatus = ConsultationSessionStatus.CONFIRMED;
    await consultation.save();
    await this.notifications.create(consultation.patientId.toString(), {
      userId: consultation.patientId.toString(),
      type: NotificationType.INFO,
      title:
        status === ConsultationRequestStatus.ACCEPTED
          ? 'Consultation accepted'
          : 'Consultation declined',
      message,
    });
    return this.legacyResponse(message, consultation);
  }

  async start(userId: string, id: string) {
    const consultation = await this.load(id);
    if (!this.same(consultation.doctorId, userId))
      throw new ForbiddenException('Only doctor can start consultation');
    if (
      consultation.requestStatus !== ConsultationRequestStatus.ACCEPTED ||
      consultation.sessionStatus !== ConsultationSessionStatus.CONFIRMED
    )
      throw new BadRequestException(
        'Consultation must be accepted before starting',
      );
    consultation.sessionStatus = ConsultationSessionStatus.IN_PROGRESS;
    consultation.sessionStartedAt = new Date();
    await consultation.save();
    return this.legacyResponse(
      'Consultation started successfully',
      consultation,
    );
  }

  async complete(userId: string, id: string, dto: UpdateSessionDto) {
    const consultation = await this.load(id);
    if (!this.same(consultation.doctorId, userId))
      throw new ForbiddenException('Only doctor can complete consultation');
    if (consultation.sessionStatus !== ConsultationSessionStatus.IN_PROGRESS)
      throw new BadRequestException('Consultation is not in progress');
    consultation.sessionStatus = ConsultationSessionStatus.COMPLETED;
    consultation.completedAt = new Date();
    consultation.completedBy = new Types.ObjectId(userId);
    consultation.doctorNotes = dto.doctorNotes;
    await consultation.save();
    return this.legacyResponse(
      'Consultation completed successfully',
      consultation,
    );
  }

  async cancel(userId: string, id: string, dto: UpdateSessionDto) {
    const consultation = await this.load(id);
    this.assertParticipant(consultation, userId);
    if (consultation.sessionStatus === ConsultationSessionStatus.COMPLETED)
      throw new BadRequestException('Cannot cancel completed consultation');
    consultation.requestStatus = ConsultationRequestStatus.CANCELLED;
    consultation.sessionStatus = ConsultationSessionStatus.CANCELLED;
    consultation.cancelledAt = new Date();
    consultation.cancelledBy = new Types.ObjectId(userId);
    consultation.cancellationReason = dto.doctorNotes ?? dto.patientNotes;
    await consultation.save();
    return this.legacyResponse(
      'Consultation cancelled successfully',
      consultation,
    );
  }

  async reschedule(userId: string, id: string, dto: UpdateSessionDto) {
    const consultation = await this.load(id);
    this.assertParticipant(consultation, userId);
    if (!dto.scheduledAt || new Date(dto.scheduledAt) < new Date())
      throw new BadRequestException('A future scheduledAt is required');
    consultation.scheduledStartAt = new Date(dto.scheduledAt);
    consultation.requestStatus = ConsultationRequestStatus.PENDING;
    consultation.respondedAt = undefined;
    await consultation.save();
    return this.legacyResponse(
      'Consultation rescheduled successfully',
      consultation,
    );
  }

  async remove(userId: string, id: string) {
    const consultation = await this.load(id);
    if (!this.same(consultation.patientId, userId))
      throw new ForbiddenException('Only patient can delete consultation');
    if (consultation.requestStatus !== ConsultationRequestStatus.PENDING)
      throw new BadRequestException('Can only delete pending consultation');
    await this.consultationModel.deleteOne({ _id: consultation._id });
    return { statusCode: 200, message: 'Consultation deleted successfully' };
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
            ConsultationSessionStatus.CONFIRMED,
            ConsultationSessionStatus.IN_PROGRESS,
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
      data: items.map((item) => this.toLegacy(item)),
      count: items.length,
    };
  }

  private async load(id: string): Promise<ConsultationDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid consultation ID');
    const item = await this.consultationModel.findById(id);
    if (!item) throw new NotFoundException('Consultation not found');
    return item;
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
  private applyLegacyStatusFilter(
    filter: Record<string, unknown>,
    status: string,
  ) {
    if (status === 'pending')
      filter.requestStatus = ConsultationRequestStatus.PENDING;
    else if (status === 'rejected')
      filter.requestStatus = {
        $in: [
          ConsultationRequestStatus.DECLINED,
          ConsultationRequestStatus.CANCELLED,
        ],
      };
    else if (status === 'completed')
      filter.sessionStatus = ConsultationSessionStatus.COMPLETED;
    else if (status === 'active')
      filter.sessionStatus = {
        $in: [
          ConsultationSessionStatus.CONFIRMED,
          ConsultationSessionStatus.IN_PROGRESS,
        ],
      };
  }
  private legacyResponse(
    message: string,
    item: ConsultationDocument | Record<string, any>,
    statusCode = 200,
  ) {
    return { statusCode, message, data: this.toLegacy(item) };
  }
  private toLegacy(item: ConsultationDocument | Record<string, any>) {
    const value =
      typeof (item as any).toObject === 'function'
        ? (item as any).toObject()
        : item;
    const status =
      value.requestStatus === 'pending'
        ? 'pending'
        : value.requestStatus === 'declined' ||
            value.requestStatus === 'cancelled'
          ? 'rejected'
          : value.sessionStatus === 'completed'
            ? 'completed'
            : value.sessionStatus === 'in_progress' ||
                value.requestStatus === 'accepted'
              ? 'active'
              : 'pending';
    return {
      ...value,
      id: value._id,
      status,
      scheduledAt: value.scheduledStartAt,
    };
  }
}
