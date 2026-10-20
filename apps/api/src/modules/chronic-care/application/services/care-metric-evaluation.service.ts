import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  HEALTH_METRIC,
  type HealthMetricPort,
} from '../../../health-tracking/public-api';
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
  ) {}

  async evaluateRecordedMetric(metricId: string) {
    if (!this.metrics.findForCareEvaluation)
      throw new Error('Care metric query is unavailable');
    const metric = await this.metrics.findForCareEvaluation(metricId);
    if (!metric) return;
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
        await this.evaluations.evaluateMetric({
          enrollmentId: String(enrollment._id),
          metricId: metric.id,
          values: metric.values,
          recordedAt: metric.recordedAt,
          ingestedAt: metric.ingestedAt,
        });
      }
      if (batch.length < 100) break;
      after = batch[batch.length - 1]._id;
    }
  }
}
