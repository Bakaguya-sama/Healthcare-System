import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { CareTaskConsultationPort } from '../../ports/care-task-consultation.port';
import {
  Consultation,
  ConsultationDocument,
  ConsultationMode,
  ConsultationRequestStatus,
} from '../../../domain/entities/consultations/consultation.entity';

@Injectable()
export class CareTaskConsultationLinkService
  implements CareTaskConsultationPort
{
  constructor(
    @InjectModel(Consultation.name)
    private readonly consultations: Model<ConsultationDocument>,
  ) {}

  async linkCareTask(input: Parameters<CareTaskConsultationPort['linkCareTask']>[0]) {
    if (
      !Types.ObjectId.isValid(input.consultationId) ||
      !Types.ObjectId.isValid(input.careTaskId) ||
      !Types.ObjectId.isValid(input.patientId) ||
      !Types.ObjectId.isValid(input.doctorId)
    )
      throw new NotFoundException('Consultation not found');
    const consultation = await this.consultations
      .findOne({
        _id: new Types.ObjectId(input.consultationId),
        patientId: new Types.ObjectId(input.patientId),
        doctorId: new Types.ObjectId(input.doctorId),
        mode: ConsultationMode.SCHEDULED,
        requestStatus: ConsultationRequestStatus.ACCEPTED,
      })
      .session(input.session)
      .exec();
    if (!consultation) throw new NotFoundException('Consultation not found');
    const careTaskId = new Types.ObjectId(input.careTaskId);
    if (consultation.careTaskId) {
      if (!consultation.careTaskId.equals(careTaskId))
        throw new ConflictException({
          code: 'CARE_TASK_CONSULTATION_ALREADY_LINKED',
          message: 'Consultation is linked to another Care Task',
        });
      return { consultationId: String(consultation._id) };
    }
    consultation.careTaskId = careTaskId;
    try {
      await consultation.save({ session: input.session });
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new ConflictException({
          code: 'CARE_TASK_CONSULTATION_ALREADY_LINKED',
          message: 'Care Task is linked to another Consultation',
        });
      throw error;
    }
    return { consultationId: String(consultation._id) };
  }
}
