import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { AuditLog } from '../../../platform-audit/public-api';
import {
  CareTask,
  CareTaskDocument,
  CareTaskStatus,
  CareTaskType,
} from '../../domain/entities/care-task.entity';
import { HealthEvaluationService } from './health-evaluation.service';

export type ConsultationCareTaskOutcome =
  | 'completed'
  | 'no_show'
  | 'cancelled'
  | 'rescheduled';

@Injectable()
export class CareTaskPolicyEventService {
  constructor(
    @InjectModel(CareTask.name)
    private readonly tasks: Model<CareTaskDocument>,
    @InjectModel(AuditLog.name) private readonly audits: Model<AuditLog>,
    @InjectConnection() private readonly connection: Connection,
    private readonly evaluations: HealthEvaluationService,
  ) {}

  async evaluateCheckIn(taskId: string, enrollmentId: string) {
    if (!Types.ObjectId.isValid(taskId) || !Types.ObjectId.isValid(enrollmentId))
      throw new Error('Invalid check-in event identifiers');
    const task = await this.tasks
      .findOne({
        _id: new Types.ObjectId(taskId),
        patientCareProgramId: new Types.ObjectId(enrollmentId),
        taskType: CareTaskType.CHECK_IN,
        status: CareTaskStatus.COMPLETED,
        completionSourceType: 'patientResponse',
      })
      .select('response completedAt')
      .lean()
      .exec();
    if (!task) throw new Error('Completed check-in Care Task not found');
    const response = task.response as Record<string, unknown> | undefined;
    if (
      response?.kind !== 'health_check_in_v1' ||
      response.schemaVersion !== 'health-check-in.v1' ||
      !['improved', 'stable', 'worsened'].includes(
        String(response.overallStatus),
      ) ||
      !['none', 'mild', 'moderate', 'severe'].includes(
        String(response.severity),
      ) ||
      !Array.isArray(response.symptomCodes) ||
      response.symptomCodes.some((code) => typeof code !== 'string')
    )
      throw new Error('Stored check-in response is invalid');

    const severity = String(response.severity);
    const severityRank: Record<string, number> = {
      none: 0,
      mild: 1,
      moderate: 2,
      severe: 3,
    };
    const facts: Record<string, unknown> = {
      'check_in.overall_status': response.overallStatus,
      'check_in.severity': severity,
      'check_in.severity_rank': severityRank[severity],
    };
    for (const code of response.symptomCodes as string[])
      facts[`check_in.symptom.${code}`] = true;
    const submittedAt = new Date(
      (response.submittedAt as string | Date | undefined) ??
        task.completedAt ??
        Date.now(),
    );
    if (Number.isNaN(submittedAt.getTime()))
      throw new Error('Stored check-in timestamp is invalid');
    return this.evaluations.evaluateCheckIn({
      enrollmentId,
      careTaskId: taskId,
      facts,
      submittedAt,
    });
  }

  async applyConsultationLifecycle(input: {
    careTaskId: string;
    consultationId: string;
    outcome: ConsultationCareTaskOutcome;
    occurredAt: string;
    objectiveDisposition?: 'no_longer_required' | 'unknown';
  }) {
    if (
      !Types.ObjectId.isValid(input.careTaskId) ||
      !Types.ObjectId.isValid(input.consultationId)
    )
      throw new Error('Invalid consultation Care Task event identifiers');
    const occurredAt = new Date(input.occurredAt);
    if (Number.isNaN(occurredAt.getTime()))
      throw new Error('Invalid consultation Care Task event time');

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const task = await this.tasks
          .findOne({
            _id: new Types.ObjectId(input.careTaskId),
            taskType: CareTaskType.APPOINTMENT,
          })
          .session(session)
          .exec();
        if (!task) throw new Error('Appointment Care Task not found');
        if (
          task.completionSourceId &&
          !task.completionSourceId.equals(
            new Types.ObjectId(input.consultationId),
          )
        )
          throw new Error('Appointment Care Task is linked to another consultation');

        let target: CareTaskStatus | undefined;
        if (input.outcome === 'completed') target = CareTaskStatus.COMPLETED;
        if (input.outcome === 'no_show') target = CareTaskStatus.MISSED;
        if (
          input.outcome === 'cancelled' &&
          input.objectiveDisposition === 'no_longer_required'
        )
          target = CareTaskStatus.CANCELLED;

        if (!target) {
          if (input.outcome === 'rescheduled') {
            task.completionSourceType = 'consultation';
            task.completionSourceId = new Types.ObjectId(input.consultationId);
            await task.save({ session });
          }
          return;
        }
        if (task.status === target) return;
        if (
          ![CareTaskStatus.SCHEDULED, CareTaskStatus.DUE].includes(task.status)
        )
          return;
        const fromStatus = task.status;
        task.status = target;
        task.completionSourceType = 'consultation';
        task.completionSourceId = new Types.ObjectId(input.consultationId);
        if (target === CareTaskStatus.COMPLETED) task.completedAt = occurredAt;
        if (target === CareTaskStatus.MISSED) task.missedAt = occurredAt;
        if (target === CareTaskStatus.CANCELLED) {
          task.cancelledAt = occurredAt;
          task.cancellationReason = 'care_objective_no_longer_required';
        }
        await task.save({ session });
        await this.audits.create(
          [
            {
              domain: 'care',
              entityType: 'careTask',
              entityId: task._id,
              action: 'care_task_consultation_lifecycle_applied',
              fromStatus,
              toStatus: target,
              metadata: {
                consultationId: input.consultationId,
                outcome: input.outcome,
              },
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }
}
