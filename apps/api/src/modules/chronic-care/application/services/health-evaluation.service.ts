import { Injectable, Optional } from '@nestjs/common';
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
  HealthEvaluationSourceType,
} from '../../domain/entities/health-evaluation.entity';
import {
  CareRule,
  CareRuleDocument,
  CareRuleStatus,
} from '../../domain/entities/care-rule.entity';
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
    @Optional()
    @InjectModel(CareRule.name)
    private readonly rules?: Model<CareRuleDocument>,
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
      throw new Error('Invalid enrollment or metric ID');
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
      throw new Error('Invalid care rule snapshot');
    const uniqueKey = `${enrollment.id}:${snapshot.careRuleId}:${snapshot.revision}:${input.metricId}:${input.ingestedAt.toISOString()}`;
    const existing = await this.evaluations.findOne({ uniqueKey }).exec();
    if (existing) {
      await this.alerts.createForEvaluation(existing);
      return existing;
    }
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
    const evaluationData = {
      patientCareProgramId: enrollment._id,
      patientId: enrollment.patientId,
      ...(input.careTaskId && Types.ObjectId.isValid(input.careTaskId)
        ? { careTaskId: new Types.ObjectId(input.careTaskId) }
        : {}),
      healthMetricId: new Types.ObjectId(input.metricId),
      sourceType: HealthEvaluationSourceType.HEALTH_METRIC,
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
    };
    let evaluation: HealthEvaluationDocument;
    try {
      evaluation = await this.evaluations.create(evaluationData);
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const concurrent = await this.evaluations.findOne({ uniqueKey }).exec();
      if (!concurrent) throw error;
      evaluation = concurrent;
    }
    await this.alerts.createForEvaluation(evaluation);
    return evaluation;
  }

  async evaluateCheckIn(input: {
    enrollmentId: string;
    careTaskId: string;
    facts: Record<string, unknown>;
    submittedAt: Date;
  }) {
    if (
      !Types.ObjectId.isValid(input.enrollmentId) ||
      !Types.ObjectId.isValid(input.careTaskId)
    )
      throw new Error('Invalid enrollment or Care Task ID');
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
      throw new Error('Invalid care rule snapshot');
    if (!this.rules) return null;
    const activeRule = await this.rules
      .findOne({
        _id: new Types.ObjectId(String(snapshot.careRuleId)),
        careProgramId: enrollment.careProgramId,
        status: CareRuleStatus.ACTIVE,
      })
      .select('_id')
      .lean()
      .exec();
    if (!activeRule) return null;

    const uniqueKey = `${enrollment.id}:${snapshot.careRuleId}:${snapshot.revision}:check-in:${input.careTaskId}`;
    const existing = await this.evaluations.findOne({ uniqueKey }).exec();
    if (existing) {
      await this.alerts.createForEvaluation(existing);
      return existing;
    }
    const result = evaluateCareRules(
      snapshot.rules as CareRuleNode[],
      input.facts,
    );
    const evaluationData = {
      patientCareProgramId: enrollment._id,
      patientId: enrollment.patientId,
      careTaskId: new Types.ObjectId(input.careTaskId),
      sourceType: HealthEvaluationSourceType.CARE_TASK_CHECK_IN,
      careRuleId: new Types.ObjectId(String(snapshot.careRuleId)),
      severity: result.severity as HealthEvaluationSeverity,
      reasonCodes: result.reasonCodes,
      inputData: {
        schemaVersion: 'health-check-in.v1',
        ruleVersion: snapshot.version,
        ruleRevision: snapshot.revision,
        inputKeys: result.inputKeys,
      },
      timeRange: {
        startAt: input.submittedAt,
        endAt: input.submittedAt,
        timezone: enrollment.timezone,
      },
      uniqueKey,
      evaluatedAt: new Date(),
    };
    let evaluation: HealthEvaluationDocument;
    try {
      evaluation = await this.evaluations.create(evaluationData);
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const concurrent = await this.evaluations.findOne({ uniqueKey }).exec();
      if (!concurrent) throw error;
      evaluation = concurrent;
    }
    await this.alerts.createForEvaluation(evaluation);
    return evaluation;
  }
}
