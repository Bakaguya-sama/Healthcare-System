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
} from '../../domain/tasks/care-task-template.validator';
import {
  localDate,
  localDateTimeToUtc,
  nextLocalDate,
} from '../../domain/tasks/care-task-timezone';
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
    let created = 0;
    let enrollmentCount = 0;
    let after: Types.ObjectId | undefined;
    for (;;) {
      const enrollments = await this.enrollments
        .find({
          status: PatientCareProgramStatus.ACTIVE,
          ...(after ? { _id: { $gt: after } } : {}),
        })
        .sort({ _id: 1 })
        .limit(100)
        .exec();
      for (const enrollment of enrollments)
        created += await this.scheduleEnrollment(enrollment, now, horizonDays);
      enrollmentCount += enrollments.length;
      if (enrollments.length < 100) break;
      after = enrollments[enrollments.length - 1]._id;
    }
    await this.reconcileInactiveEnrollmentTasks();
    return { enrollments: enrollmentCount, created };
  }

  /** Applies the current enrollment state, not a possibly stale event snapshot. */
  async syncEnrollmentTasksToCurrentState(
    enrollmentId: string,
    eventRevision: number,
    now = new Date(),
    allowScheduling = true,
  ) {
    if (!Types.ObjectId.isValid(enrollmentId))
      throw new Error('Invalid care enrollment sync event');
    const id = new Types.ObjectId(enrollmentId);
    const enrollment = await this.enrollments.findById(id).exec();
    if (!enrollment) {
      await this.cancelEnrollmentTasks(id, 'enrollment_missing');
      return { status: 'missing' as const };
    }
    if (enrollment.revision < eventRevision)
      throw new Error('Care enrollment event is ahead of persisted state');
    if (enrollment.status === PatientCareProgramStatus.ACTIVE) {
      if (!allowScheduling)
        return { status: 'active_scheduling_disabled' as const, revision: enrollment.revision };
      await this.scheduleEnrollment(enrollment, now);
      await this.advanceTaskStatuses(now);
      return { status: 'active' as const, revision: enrollment.revision };
    }
    await this.cancelEnrollmentTasks(
      id,
      `enrollment_${enrollment.status}`.slice(0, 500),
    );
    return { status: enrollment.status, revision: enrollment.revision };
  }

  /** Reconciles every still-open task in stable batches; it never trusts old outbox state. */
  async reconcileInactiveEnrollmentTasks(batchSize = 200) {
    const limit = Math.max(1, Math.min(500, Math.floor(batchSize)));
    const now = new Date();
    let after: Types.ObjectId | undefined;
    let cancelled = 0;
    for (;;) {
      const tasks = await this.tasks
        .find({
          status: { $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE] },
          ...(after ? { _id: { $gt: after } } : {}),
        })
        .select('_id patientCareProgramId')
        .sort({ _id: 1 })
        .limit(limit)
        .lean()
        .exec();
      if (!tasks.length) break;
      const enrollmentIds = [
        ...new Map(
          tasks.map((task) => [String(task.patientCareProgramId), task.patientCareProgramId]),
        ).values(),
      ];
      const enrollments = await this.enrollments
        .find({ _id: { $in: enrollmentIds } })
        .select('_id status')
        .lean()
        .exec();
      const activeIds = new Set(
        enrollments
          .filter((enrollment) => enrollment.status === PatientCareProgramStatus.ACTIVE)
          .map((enrollment) => String(enrollment._id)),
      );
      const currentEnrollmentIds = new Set(enrollments.map((item) => String(item._id)));
      const inactiveIds = enrollmentIds.filter(
        (id) => !activeIds.has(String(id)),
      );
      for (const id of inactiveIds) {
        const reason = currentEnrollmentIds.has(String(id))
          ? 'enrollment_not_active'
          : 'enrollment_missing';
        const result = await this.tasks.updateMany(
          {
            patientCareProgramId: id,
            status: { $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE] },
          },
          {
            $set: {
              status: CareTaskStatus.CANCELLED,
              cancelledAt: now,
              cancellationReason: reason,
            },
          },
        );
        cancelled += result.modifiedCount;
      }
      after = tasks[tasks.length - 1]._id;
      if (tasks.length < limit) break;
    }
    return cancelled;
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
    const programVersion = snapshot.programVersion;
    const scheduleVersion =
      typeof programVersion === 'string' || typeof programVersion === 'number'
        ? String(programVersion)
        : 'v1';
    let day = localDate(now, enrollment.timezone);
    const todayLocalDate = day;
    const startedAtDate = enrollment.startedAt
      ? new Date(enrollment.startedAt)
      : null;
    const startedToday =
      startedAtDate !== null &&
      !Number.isNaN(startedAtDate.getTime()) &&
      localDate(startedAtDate, enrollment.timezone) === todayLocalDate;
    let created = 0;
    for (let index = 0; index < horizonDays; index += 1) {
      for (const template of templates) {
        const windowStart = localDateTimeToUtc(
          day,
          template.schedule.time,
          enrollment.timezone,
        );
        let windowEnd = new Date(
          windowStart.getTime() + template.schedule.windowMinutes * 60_000,
        );
        if (
          day === todayLocalDate &&
          windowEnd < now &&
          startedToday &&
          startedAtDate &&
          startedAtDate > windowStart
        ) {
          // Give newly activated day-1 patients a fair completion window instead of skipping today's morning tasks.
          const graceDurationMs = template.schedule.windowMinutes * 60_000;
          windowEnd = new Date(
            Math.max(
              windowEnd.getTime(),
              startedAtDate.getTime() + graceDurationMs,
              now.getTime() + graceDurationMs,
            ),
          );
        }
        if (windowEnd < now && day !== todayLocalDate) continue;
        const uniqueKey = `${enrollment._id}:${template.key}:${scheduleVersion}:${day}`;
        // A pause cancels open tasks, but resume must reuse the same unique key.
        // Restore only still-open windows cancelled by enrollment reconciliation;
        // completed, missed and manually cancelled tasks remain untouched.
        await this.tasks.updateOne(
          {
            uniqueKey,
            status: CareTaskStatus.CANCELLED,
            cancellationReason: { $in: ['enrollment_paused', 'enrollment_not_active'] },
            windowEnd: { $gte: now },
          },
          {
            $set: {
              status: windowStart <= now ? CareTaskStatus.DUE : CareTaskStatus.SCHEDULED,
            },
            $unset: { cancelledAt: '', cancellationReason: '' },
          },
        ).exec();
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
        if ([CareTaskStatus.SCHEDULED, CareTaskStatus.DUE].includes(task.status))
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
      ...(template.contentRef ? { contentRef: template.contentRef } : {}),
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
    let after: Types.ObjectId | undefined;
    for (;;) {
      const tasks = await this.tasks
        .find({
          taskType: 'metric',
          status: { $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE] },
          windowStart: { $lte: now },
          ...(after ? { _id: { $gt: after } } : {}),
        })
        .select(
          '_id patientCareProgramId patientId windowStart windowEnd completionRule',
        )
        .sort({ _id: 1 })
        .limit(100)
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
        // Keep the task eligible for retry until evaluation and alert creation succeed.
        const evaluated = await this.evaluations.evaluateMetric({
          enrollmentId: String(task.patientCareProgramId),
          careTaskId: String(task._id),
          metricId: metric.id,
          values: metric.values,
          recordedAt: metric.recordedAt,
          ingestedAt: metric.ingestedAt,
        });
        if (!evaluated) continue;
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
      }
      if (tasks.length < 100) break;
      after = tasks[tasks.length - 1]._id;
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
