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
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { UpdateConsultationDto } from './dto/update-consultation.dto';
import { QueryConsultationDto } from './dto/query-consultation.dto';
import {
  NotificationsService,
  NotificationType,
} from '../notifications/public-api';
import { UsersService } from '../users/public-api';

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

  async create(patientId: string, dto: CreateConsultationDto) {
    this.assertId(patientId, 'patient');
    this.assertId(dto.doctorId, 'doctor');
    const scheduledStartAt = dto.scheduledStartAt
      ? new Date(dto.scheduledStartAt)
      : undefined;
    if (scheduledStartAt && scheduledStartAt < new Date())
      throw new BadRequestException('Cannot schedule consultation in the past');
    const consultation = await this.consultationModel.create({
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(dto.doctorId),
      mode: ConsultationMode.ON_DEMAND,
      requestStatus: ConsultationRequestStatus.PENDING,
      sessionStatus: ConsultationSessionStatus.NOT_STARTED,
      requestedAt: new Date(),
      scheduledStartAt,
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
    if (dto.scheduledStartAt) {
      const scheduledStartAt = new Date(dto.scheduledStartAt);
      if (scheduledStartAt < new Date())
        throw new BadRequestException(
          'Cannot schedule consultation in the past',
        );
      consultation.scheduledStartAt = scheduledStartAt;
    }
    await consultation.save();
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
    return this.response(message, consultation);
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
    return this.response('Consultation started successfully', consultation);
  }

  async complete(userId: string, id: string, dto: UpdateConsultationDto) {
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
    return this.response('Consultation completed successfully', consultation);
  }

  async cancel(userId: string, id: string, dto: UpdateConsultationDto) {
    const consultation = await this.load(id);
    this.assertParticipant(consultation, userId);
    if (consultation.sessionStatus === ConsultationSessionStatus.COMPLETED)
      throw new BadRequestException('Cannot cancel completed consultation');
    consultation.requestStatus = ConsultationRequestStatus.CANCELLED;
    consultation.sessionStatus = ConsultationSessionStatus.CANCELLED;
    consultation.cancelledAt = new Date();
    consultation.cancelledBy = new Types.ObjectId(userId);
    consultation.cancellationReason = dto.reason;
    await consultation.save();
    return this.response('Consultation cancelled successfully', consultation);
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
