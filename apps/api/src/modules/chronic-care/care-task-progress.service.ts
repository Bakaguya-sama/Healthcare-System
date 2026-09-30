import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CareTask,
  CareTaskDocument,
  CareTaskStatus,
} from './entities/care-task.entity';

@Injectable()
export class CareTaskProgressService {
  constructor(
    @InjectModel(CareTask.name) private readonly tasks: Model<CareTaskDocument>,
  ) {}

  async listForPatient(patientId: string, enrollmentId: string) {
    return this.tasks
      .find({ patientId, patientCareProgramId: enrollmentId })
      .sort({ scheduledFor: 1, _id: 1 })
      .lean()
      .exec();
  }

  async getCompletionRate(enrollmentId: string) {
    const counts = await this.tasks.aggregate<{
      _id: CareTaskStatus;
      count: number;
    }>([
      {
        $match: {
          patientCareProgramId: new Types.ObjectId(enrollmentId),
          required: true,
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const byStatus = Object.fromEntries(
      counts.map((item) => [item._id, item.count]),
    );
    const completed = byStatus[CareTaskStatus.COMPLETED] ?? 0;
    const missed = byStatus[CareTaskStatus.MISSED] ?? 0;
    return {
      expected: completed + missed,
      completed,
      missed,
      completionRate:
        completed + missed ? completed / (completed + missed) : null,
    };
  }
}
