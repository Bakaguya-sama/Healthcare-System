import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Session,
  SessionDocument,
  SessionStatus,
} from './entities/session.entity';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
  ) {}

  async create(patientId: string, dto: CreateSessionDto) {
    return this.sessionModel.create({ ...dto, patientId });
  }

  async findByPatient(patientId: string) {
    return this.sessionModel
      .find({ patientId })
      .populate('doctorId', 'name email specialization avatarUrl')
      .sort({ scheduledAt: -1 });
  }

  async findByDoctor(doctorId: string) {
    return this.sessionModel
      .find({ doctorId })
      .populate('patientId', 'name email avatarUrl')
      .sort({ scheduledAt: -1 });
  }

  async updateStatus(id: string, userId: string, status: SessionStatus) {
    const session = await this.sessionModel.findById(id);
    if (!session) throw new NotFoundException('Session not found');

    const isInvolved =
      session.patientId.toString() === userId ||
      session.doctorId.toString() === userId;
    if (!isInvolved) throw new ForbiddenException();

    session.status = status;
    return session.save();
  }
}
