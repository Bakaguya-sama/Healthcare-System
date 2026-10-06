import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PatientCareProgram,
  PatientCareProgramDocument,
  PatientCareProgramStatus,
} from '../../domain/entities/patient-care-program.entity';
import {
  HealthEvaluation,
  HealthEvaluationDocument,
  HealthEvaluationSeverity,
} from '../../domain/entities/health-evaluation.entity';
import {
  CareRuleNode,
  evaluateCareRules,
  isCareRuleNode,
} from '../../domain/rules/care-rule-interpreter';
import { CareAlertService } from './care-alert.service';

@Injectable()
export class HealthEvaluationService {
  constructor(
    @InjectModel(PatientCareProgram.name)
    private readonly enrollments: Model<PatientCareProgramDocument>,
    @InjectModel(HealthEvaluation.name)
    private readonly evaluations: Model<HealthEvaluationDocument>,
    private readonly alerts: CareAlertService,
  ) {}

  async evaluateMetric(input: {
    enrollmentId: string;
    careTaskId?: string;
    metricId: string;
    values: Record<string, unknown>;
    recordedAt: Date;
    ingestedAt: Date;
  }) {
    if (
      !Types.ObjectId.isValid(input.enrollmentId) ||
      !Types.ObjectId.isValid(input.metricId)
    )
      return null;
    const enrollment = await this.enrollments
      .findOne({
        _id: input.enrollmentId,
        status: PatientCareProgramStatus.ACTIVE,
      })
      .exec();
    if (!enrollment) return null;
    const snapshot = (enrollment.programConfig as Record<string, unknown>)
      .ruleSnapshot as Record<string, unknown> | undefined;
    if (
      !snapshot ||
      !Types.ObjectId.isValid(String(snapshot.careRuleId)) ||
      !Array.isArray(snapshot.rules) ||
      !snapshot.rules.every(isCareRuleNode)
    )
      return null;
    const uniqueKey = `${enrollment.id}:${snapshot.careRuleId}:${snapshot.revision}:${input.metricId}:${input.ingestedAt.toISOString()}`;
    const existing = await this.evaluations.findOne({ uniqueKey }).exec();
    if (existing) return existing;
    const previous = await this.evaluations
      .findOne({
        patientCareProgramId: enrollment._id,
        healthMetricId: new Types.ObjectId(input.metricId),
      })
      .sort({ createdAt: -1 })
      .exec();
    const result = evaluateCareRules(
      snapshot.rules as CareRuleNode[],
      input.values,
    );
    const evaluation = await this.evaluations.create({
      patientCareProgramId: enrollment._id,
      patientId: enrollment.patientId,
      ...(input.careTaskId && Types.ObjectId.isValid(input.careTaskId)
        ? { careTaskId: new Types.ObjectId(input.careTaskId) }
        : {}),
      healthMetricId: new Types.ObjectId(input.metricId),
      careRuleId: new Types.ObjectId(String(snapshot.careRuleId)),
      severity: result.severity as HealthEvaluationSeverity,
      reasonCodes: result.reasonCodes,
      inputData: {
        healthMetricId: input.metricId,
        ruleVersion: snapshot.version,
        ruleRevision: snapshot.revision,
        metricIngestedAt: input.ingestedAt.toISOString(),
        inputKeys: result.inputKeys,
      },
      timeRange: {
        startAt: input.recordedAt,
        endAt: input.recordedAt,
        timezone: enrollment.timezone,
      },
      uniqueKey,
      evaluatedAt: new Date(),
      ...(previous ? { replacesEvaluationId: previous._id } : {}),
    });
    await this.alerts.createForEvaluation(evaluation);
    return evaluation;
  }
}
