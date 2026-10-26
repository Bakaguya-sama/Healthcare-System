import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CareTask,
  CareTaskDocument,
  CareTaskStatus,
} from '../../domain/entities/care-task.entity';
import {
  PatientCareProgram,
  PatientCareProgramDocument,
  PatientCareProgramStatus,
} from '../../domain/entities/patient-care-program.entity';

@Injectable()
export class CareTaskReminderService {
  constructor(
    @InjectModel(CareTask.name) private readonly tasks: Model<CareTaskDocument>,
    @InjectModel(PatientCareProgram.name)
    private readonly enrollments: Model<PatientCareProgramDocument>,
  ) {}

  async shouldNotify(taskId: string, patientId: string, now = new Date()) {
    if (!Types.ObjectId.isValid(taskId) || !Types.ObjectId.isValid(patientId))
      throw new Error('Invalid care task reminder identifiers');
    const task = await this.tasks
      .findOne({
        _id: new Types.ObjectId(taskId),
        patientId: new Types.ObjectId(patientId),
        status: { $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE] },
        windowStart: { $lte: now },
        windowEnd: { $gte: now },
      })
      .select('patientCareProgramId')
      .lean()
      .exec();
    if (!task) return false;
    return Boolean(
      await this.enrollments.exists({
        _id: task.patientCareProgramId,
        status: PatientCareProgramStatus.ACTIVE,
      }),
    );
  }
}
