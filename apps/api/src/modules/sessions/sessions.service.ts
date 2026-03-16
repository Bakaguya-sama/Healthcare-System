import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Session,
  SessionDocument,
  SessionStatus,
  SessionType,
} from './entities/session.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { QuerySessionDto } from './dto/query-session.dto';

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
  ) {}

  /**
   * 📝 TẠO SESSION MỚI
   */
  async create(patientId: string, dto: CreateSessionDto) {
    if (!Types.ObjectId.isValid(patientId)) {
      throw new BadRequestException('Invalid patient ID');
    }
    if (!Types.ObjectId.isValid(dto.doctorId)) {
      throw new BadRequestException('Invalid doctor ID');
    }

    // Check if scheduled time is not in the past
    const scheduledTime = new Date(dto.scheduledAt);
    if (scheduledTime < new Date()) {
      throw new BadRequestException('Cannot schedule session in the past');
    }

    const session = await this.sessionModel.create({
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(dto.doctorId),
      type: dto.type,
      title: dto.title,
      description: dto.description,
      scheduledAt: scheduledTime,
      duration: dto.duration || 30,
      note: dto.note,
      attachments: dto.attachments,
      status: SessionStatus.PENDING,
    });

    return {
      statusCode: 201,
      message: 'Session scheduled successfully',
      data: session,
    };
  }

  /**
   * 📊 LẤY TẤT CẢ SESSIONS (CÓ FILTER & PAGINATION)
   */
  async findAll(userId: string, userRole: string, query: QuerySessionDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const filter: any = {};

    // Filter by user role - patient sees their sessions, doctor sees their sessions
    if (userRole === 'patient') {
      filter.patientId = new Types.ObjectId(userId);
    } else if (userRole === 'doctor') {
      filter.doctorId = new Types.ObjectId(userId);
    }

    // Apply filters
    if (query.status) {
      filter.status = query.status;
    }
    if (query.type) {
      filter.type = query.type;
    }
    if (query.doctorId && userRole !== 'doctor') {
      filter.doctorId = new Types.ObjectId(query.doctorId);
    }
    if (query.patientId && userRole !== 'patient') {
      filter.patientId = new Types.ObjectId(query.patientId);
    }
    if (query.startDate || query.endDate) {
      filter.scheduledAt = {};
      if (query.startDate) {
        filter.scheduledAt.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        filter.scheduledAt.$lte = new Date(query.endDate);
      }
    }

    // Pagination & sorting
    const skip = (query.page - 1) * query.limit;
    const sort = {
      [query.sortBy || 'scheduledAt']: query.sortOrder || -1,
    };

    // Execute query
    const [data, total] = await Promise.all([
      this.sessionModel
        .find(filter)
        .populate('patientId', 'name email phoneNumber avatarUrl')
        .populate('doctorId', 'name email specialization avatarUrl')
        .sort(sort)
        .skip(skip)
        .limit(query.limit),
      this.sessionModel.countDocuments(filter),
    ]);

    return {
      statusCode: 200,
      message: 'Sessions retrieved successfully',
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * 🔍 LẤY 1 SESSION
   */
  async findOne(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid session ID');
    }

    const session = await this.sessionModel
      .findById(new Types.ObjectId(id))
      .populate('patientId', 'name email phoneNumber avatarUrl')
      .populate('doctorId', 'name email specialization avatarUrl');

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Check authorization
    if (
      session.patientId.toString() !== userId &&
      session.doctorId.toString() !== userId
    ) {
      throw new ForbiddenException('You are not authorized to view this session');
    }

    return {
      statusCode: 200,
      message: 'Session retrieved successfully',
      data: session,
    };
  }

  /**
   * ✏️ CẬP NHẬT SESSION
   */
  async update(userId: string, id: string, dto: UpdateSessionDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid session ID');
    }

    const session = await this.sessionModel.findById(new Types.ObjectId(id));

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Only patient or doctor can update
    if (
      session.patientId.toString() !== userId &&
      session.doctorId.toString() !== userId
    ) {
      throw new ForbiddenException('You are not authorized to update this session');
    }

    // Cannot update completed or cancelled sessions
    if (
      session.status === SessionStatus.COMPLETED ||
      session.status === SessionStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot update ${session.status} session`,
      );
    }

    Object.assign(session, dto);
    await session.save();

    return {
      statusCode: 200,
      message: 'Session updated successfully',
      data: session,
    };
  }

  /**
   * ✅ CONFIRM SESSION (Doctor confirms)
   */
  async confirm(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid session ID');
    }

    const session = await this.sessionModel.findById(new Types.ObjectId(id));

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Only doctor can confirm
    if (session.doctorId.toString() !== userId) {
      throw new ForbiddenException('Only doctor can confirm session');
    }

    if (session.status !== SessionStatus.PENDING) {
      throw new BadRequestException('Session is not pending');
    }

    session.status = SessionStatus.CONFIRMED;
    await session.save();

    return {
      statusCode: 200,
      message: 'Session confirmed successfully',
      data: session,
    };
  }

  /**
   * 🏁 START SESSION (Mark as in progress)
   */
  async start(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid session ID');
    }

    const session = await this.sessionModel.findById(new Types.ObjectId(id));

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Only doctor can start
    if (session.doctorId.toString() !== userId) {
      throw new ForbiddenException('Only doctor can start session');
    }

    if (session.status !== SessionStatus.CONFIRMED) {
      throw new BadRequestException('Session is not confirmed');
    }

    session.status = SessionStatus.IN_PROGRESS;
    session.startedAt = new Date();
    await session.save();

    return {
      statusCode: 200,
      message: 'Session started successfully',
      data: session,
    };
  }

  /**
   * ✔️ COMPLETE SESSION
   */
  async complete(userId: string, id: string, dto: UpdateSessionDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid session ID');
    }

    const session = await this.sessionModel.findById(new Types.ObjectId(id));

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Only doctor can complete
    if (session.doctorId.toString() !== userId) {
      throw new ForbiddenException('Only doctor can complete session');
    }

    if (session.status !== SessionStatus.IN_PROGRESS) {
      throw new BadRequestException('Session is not in progress');
    }

    session.status = SessionStatus.COMPLETED;
    session.endedAt = new Date();
    if (dto.diagnosis) session.diagnosis = dto.diagnosis;
    if (dto.prescription) session.prescription = dto.prescription;
    await session.save();

    return {
      statusCode: 200,
      message: 'Session completed successfully',
      data: session,
    };
  }

  /**
   * ❌ CANCEL SESSION
   */
  async cancel(userId: string, id: string, dto: UpdateSessionDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid session ID');
    }

    const session = await this.sessionModel.findById(new Types.ObjectId(id));

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Both patient and doctor can cancel
    if (
      session.patientId.toString() !== userId &&
      session.doctorId.toString() !== userId
    ) {
      throw new ForbiddenException('You are not authorized to cancel this session');
    }

    if (session.status === SessionStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed session');
    }

    session.status = SessionStatus.CANCELLED;
    session.cancelReason = dto.cancelReason;
    session.cancelledBy = new Types.ObjectId(userId);
    await session.save();

    return {
      statusCode: 200,
      message: 'Session cancelled successfully',
      data: session,
    };
  }

  /**
   * 🔄 RESCHEDULE SESSION
   */
  async reschedule(userId: string, id: string, dto: UpdateSessionDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid session ID');
    }

    const session = await this.sessionModel.findById(new Types.ObjectId(id));

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Both can request reschedule
    if (
      session.patientId.toString() !== userId &&
      session.doctorId.toString() !== userId
    ) {
      throw new ForbiddenException('You are not authorized to reschedule this session');
    }

    if (
      session.status === SessionStatus.COMPLETED ||
      session.status === SessionStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot reschedule this session');
    }

    if (dto.scheduledAt) {
      const newTime = new Date(dto.scheduledAt);
      if (newTime < new Date()) {
        throw new BadRequestException('Cannot reschedule to the past');
      }
      session.scheduledAt = newTime;
    }

    session.status = SessionStatus.PENDING;
    session.cancelReason = undefined;
    await session.save();

    return {
      statusCode: 200,
      message: 'Session rescheduled successfully',
      data: session,
    };
  }

  /**
   * 🗑️ XÓA SESSION
   */
  async remove(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid session ID');
    }

    const session = await this.sessionModel.findById(new Types.ObjectId(id));

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Only patient can delete (and only pending sessions)
    if (session.patientId.toString() !== userId) {
      throw new ForbiddenException('Only patient can delete session');
    }

    if (session.status !== SessionStatus.PENDING) {
      throw new BadRequestException('Can only delete pending sessions');
    }

    await this.sessionModel.findByIdAndDelete(new Types.ObjectId(id));

    return {
      statusCode: 200,
      message: 'Session deleted successfully',
    };
  }

  /**
   * 📈 GET UPCOMING SESSIONS
   */
  async getUpcoming(userId: string, userRole: string, days: number = 7) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const filter: any = {};
    if (userRole === 'patient') {
      filter.patientId = new Types.ObjectId(userId);
    } else if (userRole === 'doctor') {
      filter.doctorId = new Types.ObjectId(userId);
    }

    filter.scheduledAt = {
      $gte: new Date(),
      $lte: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    };
    filter.status = { $in: [SessionStatus.PENDING, SessionStatus.CONFIRMED] };

    const sessions = await this.sessionModel
      .find(filter)
      .populate('patientId', 'name email phoneNumber avatarUrl')
      .populate('doctorId', 'name email specialization avatarUrl')
      .sort({ scheduledAt: 1 });

    return {
      statusCode: 200,
      message: 'Upcoming sessions retrieved successfully',
      data: sessions,
      count: sessions.length,
    };
  }
}
