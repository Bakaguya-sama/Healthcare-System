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
} from '../../domain/entities/patient-care-program.entity';
import {
  CareTaskReminderEligibility,
  CareTaskReminderReader,
  MissedCareTaskCandidatePage,
} from '../../application/ports/care-task-reminder-reader.port';

const MAX_CANDIDATE_PAGE_SIZE = 200;

@Injectable()
export class MongooseCareTaskReminderReaderAdapter implements CareTaskReminderReader {
  constructor(
    @InjectModel(CareTask.name)
    private readonly tasks: Model<CareTaskDocument>,
    @InjectModel(PatientCareProgram.name)
    private readonly enrollments: Model<PatientCareProgramDocument>,
  ) {}

  async findMissedTaskCandidates(input: {
    afterId?: string;
    missedBefore: Date;
    limit: number;
  }): Promise<MissedCareTaskCandidatePage> {
    const limit = Math.max(
      1,
      Math.min(MAX_CANDIDATE_PAGE_SIZE, Math.floor(input.limit)),
    );
    const filter: Record<string, unknown> = {
      status: CareTaskStatus.MISSED,
      required: true,
      $or: [
        { missedAt: { $lte: input.missedBefore } },
        { missedAt: { $exists: false } },
      ],
    };
    if (input.afterId && Types.ObjectId.isValid(input.afterId))
      filter._id = { $gt: new Types.ObjectId(input.afterId) };

    const tasks = await this.tasks
      .find(filter)
      .select('_id patientId')
      .sort({ _id: 1 })
      .limit(limit + 1)
      .lean()
      .exec();
    const hasNextPage = tasks.length > limit;
    const page = hasNextPage ? tasks.slice(0, limit) : tasks;
    const last = page.at(-1);
    return {
      tasks: page.map((task) => ({
        taskId: String(task._id),
        patientId: String(task.patientId),
      })),
      nextCursor: hasNextPage && last ? String(last._id) : null,
    };
  }

  async readReminderEligibility(input: {
    taskId: string;
    patientId: string;
  }): Promise<CareTaskReminderEligibility | null> {
    if (
      !Types.ObjectId.isValid(input.taskId) ||
      !Types.ObjectId.isValid(input.patientId)
    )
      return null;
    const task = await this.tasks
      .findOne({
        _id: new Types.ObjectId(input.taskId),
        patientId: new Types.ObjectId(input.patientId),
      })
      .select('status required missedAt patientCareProgramId')
      .lean()
      .exec();
    if (!task) return null;
    const enrollment = await this.enrollments
      .findById(task.patientCareProgramId)
      .select('status')
      .lean()
      .exec();
    return {
      taskStatus: task.status,
      required: task.required,
      missedAt: task.missedAt ?? null,
      patientCareProgramId: String(task.patientCareProgramId),
      enrollmentStatus: enrollment?.status ?? null,
    };
  }
}
