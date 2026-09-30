import { Inject, Injectable } from '@nestjs/common';
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
import {
  CareTaskTemplate,
  validateCareTaskTemplates,
} from '../../utils/care-task-template.validator';
import {
  localDate,
  localDateTimeToUtc,
  nextLocalDate,
} from '../../utils/care-task-timezone';
import {
  HEALTH_METRIC,
  type HealthMetricPort,
} from '../../../health-tracking/public-api';
import {
  CARE_TASK_QUEUE,
  type CareTaskQueue,
} from '../ports/care-task-queue.port';
import { HealthEvaluationService } from './health-evaluation.service';

@Injectable()
export class CareTaskSchedulerService {
  constructor(
    @InjectModel(CareTask.name) private readonly tasks: Model<CareTaskDocument>,
    @InjectModel(PatientCareProgram.name)
    private readonly enrollments: Model<PatientCareProgramDocument>,
    @Inject(CARE_TASK_QUEUE) private readonly taskQueue: CareTaskQueue,
    @Inject(HEALTH_METRIC) private readonly metrics: HealthMetricPort,
    private readonly evaluations: HealthEvaluationService,
  ) {}

  async scheduleActiveEnrollments(now = new Date(), horizonDays = 7) {
    await this.advanceTaskStatuses(now);
    const enrollments = await this.enrollments
      .find({ status: PatientCareProgramStatus.ACTIVE })
      .exec();
    let created = 0;
    for (const enrollment of enrollments)
      created += await this.scheduleEnrollment(enrollment, now, horizonDays);
    return { enrollments: enrollments.length, created };
  }

  async scheduleEnrollment(
    enrollment: PatientCareProgramDocument,
    now = new Date(),
    horizonDays = 7,
  ) {
    const snapshot = enrollment.programConfig as Record<string, unknown>;
    const templates = validateCareTaskTemplates(snapshot.taskTemplates);
    if (!templates || enrollment.status !== PatientCareProgramStatus.ACTIVE)
      return 0;
    const scheduleVersion = String(snapshot.programVersion ?? 'v1');
    let day = localDate(now, enrollment.timezone);
    let created = 0;
    for (let index = 0; index < horizonDays; index += 1) {
      for (const template of templates) {
        const windowStart = localDateTimeToUtc(
          day,
          template.schedule.time,
          enrollment.timezone,
        );
        const windowEnd = new Date(
          windowStart.getTime() + template.schedule.windowMinutes * 60_000,
        );
        if (windowEnd < now) continue;
        const uniqueKey = `${enrollment._id}:${template.key}:${scheduleVersion}:${day}`;
        const task = await this.tasks
          .findOneAndUpdate(
            { uniqueKey },
            {
              $setOnInsert: this.newTask(
                enrollment,
                template,
                scheduleVersion,
                uniqueKey,
                windowStart,
                windowEnd,
                now,
              ),
            },
            { new: true, upsert: true },
          )
          .exec();
        created += 1;
        await this.taskQueue.enqueue({
          taskId: String(task._id),
          patientId: String(task.patientId),
          scheduledFor: task.scheduledFor,
        });
      }
      day = nextLocalDate(day);
    }
    return created;
  }

  private newTask(
    enrollment: PatientCareProgramDocument,
    template: CareTaskTemplate,
    scheduleVersion: string,
    uniqueKey: string,
    windowStart: Date,
    windowEnd: Date,
    now: Date,
  ) {
    const snapshot = enrollment.programConfig as Record<string, unknown>;
    return {
      patientCareProgramId: enrollment._id,
      patientId: enrollment.patientId,
      doctorId: enrollment.doctorId,
      templateKey: template.key,
      taskType: template.type,
      status:
        windowStart <= now ? CareTaskStatus.DUE : CareTaskStatus.SCHEDULED,
      required: template.required ?? true,
      scheduleVersion,
      scheduledFor: windowStart,
      windowStart,
      windowEnd,
      completionRule: template.completionRule ?? {},
      reminderPolicy: template.reminderPolicy ?? snapshot.reminderPolicy ?? {},
      uniqueKey,
    };
  }

  async advanceTaskStatuses(now = new Date()) {
    await this.tasks
      .updateMany(
        { status: CareTaskStatus.SCHEDULED, windowStart: { $lte: now } },
        { $set: { status: CareTaskStatus.DUE } },
      )
      .exec();
    await this.completeMetricTasks(now);
    await this.tasks
      .updateMany(
        {
          status: { $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE] },
          windowEnd: { $lt: now },
        },
        { $set: { status: CareTaskStatus.MISSED, missedAt: now } },
      )
      .exec();
  }

  private async completeMetricTasks(now: Date) {
    const tasks = await this.tasks
      .find({
        taskType: 'metric',
        status: { $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE] },
        windowStart: { $lte: now },
      })
      .select('_id patientId windowStart windowEnd completionRule')
      .exec();
    for (const task of tasks) {
      const metricType = (task.completionRule as Record<string, unknown>)
        .metricType;
      if (typeof metricType !== 'string') continue;
      const metric = await this.metrics.findFirstRecordedInWindow({
        patientId: String(task.patientId),
        metricType,
        from: task.windowStart,
        to: task.windowEnd,
      });
      if (!metric || !Types.ObjectId.isValid(metric.id)) continue;
      await this.tasks
        .updateOne(
          {
            _id: task._id,
            status: { $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE] },
          },
          {
            $set: {
              status: CareTaskStatus.COMPLETED,
              completionSourceType: 'healthMetric',
              completionSourceId: new Types.ObjectId(metric.id),
              completedAt: metric.recordedAt,
            },
          },
        )
        .exec();
      await this.evaluations.evaluateMetric({
        enrollmentId: String(task.patientCareProgramId),
        careTaskId: String(task._id),
        metricId: metric.id,
        values: metric.values,
        recordedAt: metric.recordedAt,
        updatedAt: metric.updatedAt,
      });
    }
  }

  async cancelEnrollmentTasks(enrollmentId: Types.ObjectId, reason: string) {
    return this.tasks
      .updateMany(
        {
          patientCareProgramId: enrollmentId,
          status: { $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE] },
        },
        {
          $set: {
            status: CareTaskStatus.CANCELLED,
            cancelledAt: new Date(),
            cancellationReason: reason,
          },
        },
      )
      .exec();
  }
}
