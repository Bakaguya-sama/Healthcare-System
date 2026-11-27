import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  HEALTH_METRIC,
  type HealthMetricPort,
} from '../../../health-tracking/public-api';
import {
  CareTask,
  CareTaskDocument,
  CareTaskStatus,
  CareTaskType,
} from '../../domain/entities/care-task.entity';
import {
  PatientCareProgram,
  PatientCareProgramDocument,
  PatientCareProgramStatus,
} from '../../domain/entities/patient-care-program.entity';
import { validateCareTaskTemplates } from '../../domain/tasks/care-task-template.validator';
import { HealthEvaluationService } from './health-evaluation.service';

@Injectable()
export class CareMetricEvaluationService {
  constructor(
    @Inject(HEALTH_METRIC) private readonly metrics: HealthMetricPort,
    @InjectModel(PatientCareProgram.name)
    private readonly enrollments: Model<PatientCareProgramDocument>,
    private readonly evaluations: HealthEvaluationService,
    @Optional()
    @InjectModel(CareTask.name)
    private readonly tasks?: Model<CareTaskDocument>,
  ) {}

  async evaluateRecordedMetric(metricId: string) {
    if (!this.metrics.findForCareEvaluation)
      throw new Error('Care metric query is unavailable');
    const metric = await this.metrics.findForCareEvaluation(metricId);
    if (!metric) return;
    const canCompleteTasks =
      Boolean(this.tasks) &&
      (!metric.validationStatus || metric.validationStatus === 'valid') &&
      Types.ObjectId.isValid(metric.id);
    let after: Types.ObjectId | undefined;
    for (;;) {
      const batch = await this.enrollments
        .find({
          patientId: new Types.ObjectId(metric.patientId),
          status: PatientCareProgramStatus.ACTIVE,
          ...(after ? { _id: { $gt: after } } : {}),
        })
        .sort({ _id: 1 })
        .limit(100)
        .exec();
      for (const enrollment of batch) {
        const config = enrollment.programConfig as Record<string, unknown>;
        const templates = validateCareTaskTemplates(config.taskTemplates);
        if (!templates) throw new Error('Invalid care task templates');
        if (
          !templates.some(
            (template) =>
              template.type === 'metric' &&
              template.completionRule?.metricType === metric.metricType,
          )
        )
          continue;

        const matchingTasks = canCompleteTasks
          ? await this.tasks!
              .find({
                patientCareProgramId: enrollment._id,
                patientId: new Types.ObjectId(metric.patientId),
                taskType: CareTaskType.METRIC,
                status: {
                  $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE],
                },
                'completionRule.metricType': metric.metricType,
                windowStart: { $lte: metric.recordedAt },
                windowEnd: { $gte: metric.recordedAt },
              })
              .select('_id')
              .sort({ windowStart: 1, _id: 1 })
              .limit(20)
              .lean()
              .exec()
          : [];

        const evaluated = await this.evaluations.evaluateMetric({
          enrollmentId: String(enrollment._id),
          ...(matchingTasks[0]
            ? { careTaskId: String(matchingTasks[0]._id) }
            : {}),
          metricId: metric.id,
          values: metric.values,
          recordedAt: metric.recordedAt,
          ingestedAt: metric.ingestedAt,
        });

        if (evaluated && matchingTasks.length > 0 && this.tasks) {
          await this.tasks
            .updateMany(
              {
                _id: { $in: matchingTasks.map((task) => task._id) },
                status: {
                  $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE],
                },
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
      }
      if (batch.length < 100) break;
      after = batch[batch.length - 1]._id;
    }
  }
}
