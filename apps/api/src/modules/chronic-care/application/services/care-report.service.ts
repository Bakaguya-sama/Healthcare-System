import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { UserRole } from '../../../../core/domain/user.enums';
import {
  CARE_REPORT_CONSULTATION,
  type CareReportConsultationPort,
} from '../../../consultations/public-api';
import {
  HEALTH_METRIC,
  type HealthMetricPort,
} from '../../../health-tracking/public-api';
import {
  CareAlert,
  CareAlertDocument,
} from '../../domain/entities/care-alert.entity';
import {
  CareReport,
  CareReportDocument,
  CareReportStatus,
  CareReportType,
} from '../../domain/entities/care-report.entity';
import {
  CareTask,
  CareTaskDocument,
} from '../../domain/entities/care-task.entity';
import {
  HealthEvaluation,
  HealthEvaluationDocument,
} from '../../domain/entities/health-evaluation.entity';
import {
  PatientCareProgram,
  PatientCareProgramDocument,
} from '../../domain/entities/patient-care-program.entity';
import { aggregateCareReportFacts } from '../../domain/reports/care-report-aggregator';
import {
  SUMMARY_INPUT_VERSION_V1,
  type SummaryInputV1,
} from '../../domain/reports/summary-input-v1';
import {
  resolveCareReportWindow,
  resolveCareTaskStatusAtCutoff,
} from '../../utils/care-report-window';
import type { CareActor } from './care-program-rule.service';

const REPORT_PROJECTION =
  '_id patientCareProgramId patientId careRuleId reportType dataFormatVersion windowStart windowEnd timezone dataUntil status statistics trends missingData healthEvaluationSummary consultationSummary sourceData inputHash reportVersion replacesReportId generatedAt createdAt';

type CareReportView = Record<string, unknown> & {
  _id: Types.ObjectId;
  inputHash: string;
  reportVersion: number;
  replacesReportId?: Types.ObjectId;
  sourceData?: {
    counts?: Record<string, number>;
    references?: Record<string, string[]>;
  };
  healthEvaluationSummary?: Record<string, unknown>;
  summaryInput: SummaryInputV1;
};

type CareReportReadModel = {
  _id: Types.ObjectId;
  patientCareProgramId: Types.ObjectId;
  patientId: Types.ObjectId;
  careRuleId: Types.ObjectId;
  reportType: CareReportType;
  dataFormatVersion: string;
  windowStart: Date;
  windowEnd: Date;
  timezone: string;
  dataUntil: Date;
  status: CareReportStatus;
  statistics: Record<string, unknown>;
  trends: Record<string, unknown>;
  missingData: unknown[];
  healthEvaluationSummary: Record<string, unknown>;
  consultationSummary?: Record<string, unknown>;
  sourceData: {
    counts?: Record<string, number>;
    references?: Record<string, string[]>;
  };
  inputHash: string;
  reportVersion: number;
  replacesReportId?: Types.ObjectId;
  generatedAt: Date;
  createdAt?: Date;
};

function stableValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  return value;
}

function numberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number',
    ),
  );
}

export function projectPatientHealthEvaluationSummary(
  summary: Record<string, unknown>,
) {
  return {
    total: typeof summary.total === 'number' ? summary.total : 0,
    bySeverity: numberRecord(summary.bySeverity),
  };
}

@Injectable()
export class CareReportService {
  constructor(
    @InjectModel(CareReport.name)
    private readonly reports: Model<CareReportDocument>,
    @InjectModel(PatientCareProgram.name)
    private readonly enrollments: Model<PatientCareProgramDocument>,
    @InjectModel(CareTask.name) private readonly tasks: Model<CareTaskDocument>,
    @InjectModel(HealthEvaluation.name)
    private readonly evaluations: Model<HealthEvaluationDocument>,
    @InjectModel(CareAlert.name)
    private readonly alerts: Model<CareAlertDocument>,
    @Inject(HEALTH_METRIC) private readonly metrics: HealthMetricPort,
    @Inject(CARE_REPORT_CONSULTATION)
    private readonly consultations: CareReportConsultationPort,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  private fail(code: string, status: HttpStatus, message: string): never {
    throw new HttpException({ code, message }, status);
  }

  private objectId(value: string) {
    if (!Types.ObjectId.isValid(value))
      this.fail(
        'CARE_REPORT_NOT_FOUND',
        HttpStatus.NOT_FOUND,
        'Care report not found',
      );
    return new Types.ObjectId(value);
  }

  private authorize(
    actor: CareActor,
    enrollment: Pick<PatientCareProgram, 'patientId' | 'doctorId'>,
  ) {
    const owner =
      actor.role === UserRole.PATIENT
        ? String(enrollment.patientId)
        : actor.role === UserRole.DOCTOR
          ? String(enrollment.doctorId)
          : null;
    if (owner !== actor.id)
      this.fail(
        'CARE_FORBIDDEN',
        HttpStatus.FORBIDDEN,
        'Care report access is forbidden',
      );
  }

  private hash(value: unknown) {
    return createHash('sha256')
      .update(JSON.stringify(stableValue(value)))
      .digest('hex');
  }

  async generate(
    actor: CareActor,
    enrollmentId: string,
    reportType: CareReportType,
    dataUntil: Date,
  ) {
    if (actor.role !== UserRole.DOCTOR)
      this.fail(
        'CARE_FORBIDDEN',
        HttpStatus.FORBIDDEN,
        'Only the assigned Doctor can generate a report',
      );
    const enrollment = await this.enrollments
      .findById(this.objectId(enrollmentId))
      .select('_id patientId doctorId careRuleId timezone')
      .lean()
      .exec();
    if (!enrollment)
      this.fail(
        'CARE_ENROLLMENT_NOT_FOUND',
        HttpStatus.NOT_FOUND,
        'Enrollment not found',
      );
    this.authorize(actor, enrollment);
    if (Number.isNaN(dataUntil.getTime()) || dataUntil > new Date())
      this.fail(
        'CARE_REPORT_CUTOFF_INVALID',
        HttpStatus.BAD_REQUEST,
        'Report cutoff is invalid',
      );
    const days = reportType === CareReportType.WEEKLY ? 7 : 30;
    const { windowStart, windowEnd } = resolveCareReportWindow({
      dataUntil,
      timezone: enrollment.timezone,
      days,
    });
    const [tasks, evaluations, alerts, metricResult, consultationResult] =
      await Promise.all([
        this.tasks
          .find({
            patientCareProgramId: enrollment._id,
            required: true,
            createdAt: { $lte: dataUntil },
            windowStart: { $gte: windowStart },
            windowEnd: { $lte: windowEnd },
          })
          .select(
            '_id templateKey scheduledFor windowStart windowEnd completedAt missedAt cancelledAt createdAt',
          )
          .sort({ scheduledFor: 1, _id: 1 })
          .lean()
          .exec(),
        this.evaluations
          .find({
            patientCareProgramId: enrollment._id,
            'timeRange.startAt': { $gte: windowStart, $lt: windowEnd },
            evaluatedAt: { $lte: dataUntil },
          })
          .select('_id severity reasonCodes evaluatedAt')
          .sort({ evaluatedAt: 1, _id: 1 })
          .lean()
          .exec(),
        this.alerts
          .find({
            patientCareProgramId: enrollment._id,
            detectedAt: { $gte: windowStart, $lt: windowEnd, $lte: dataUntil },
          })
          .select('_id severity status detectedAt')
          .sort({ detectedAt: 1, _id: 1 })
          .lean()
          .exec(),
        this.metrics.listRecordedInWindow({
          patientId: String(enrollment.patientId),
          from: windowStart,
          to: windowEnd,
          ingestedUntil: dataUntil,
          limit: 5_000,
        }),
        this.consultations.listForCareReport({
          patientCareProgramId: String(enrollment._id),
          patientId: String(enrollment.patientId),
          from: windowStart,
          to: windowEnd,
          updatedUntil: dataUntil,
          limit: 1_000,
        }),
      ]);
    if (metricResult.truncated || consultationResult.truncated)
      this.fail(
        'CARE_REPORT_SOURCE_LIMIT_EXCEEDED',
        HttpStatus.CONFLICT,
        'Report source data exceeds the safe processing limit',
      );

    const facts = aggregateCareReportFacts({
      tasks: tasks.map((task) => ({
        id: String(task._id),
        templateKey: task.templateKey,
        status: resolveCareTaskStatusAtCutoff({
          windowEnd: task.windowEnd,
          ...(task.completedAt ? { completedAt: task.completedAt } : {}),
          ...(task.missedAt ? { missedAt: task.missedAt } : {}),
          ...(task.cancelledAt ? { cancelledAt: task.cancelledAt } : {}),
          dataUntil,
        }),
        scheduledFor: task.scheduledFor,
        windowStart: task.windowStart,
        windowEnd: task.windowEnd,
      })),
      metrics: metricResult.items,
      evaluations: evaluations.map((evaluation) => ({
        id: String(evaluation._id),
        severity: evaluation.severity,
        reasonCodes: evaluation.reasonCodes,
        evaluatedAt: evaluation.evaluatedAt,
      })),
      alerts: alerts.map((alert) => ({
        id: String(alert._id),
        severity: alert.severity,
        status: alert.status,
        detectedAt: alert.detectedAt,
      })),
    });
    const consultationSummary = {
      total: consultationResult.items.length,
      completed: consultationResult.items.filter(
        (item) => item.sessionStatus === 'completed',
      ).length,
      followUpScheduled: consultationResult.items.filter(
        (item) => item.followUpAt,
      ).length,
      linkedAlertIds: [
        ...new Set(
          consultationResult.items.flatMap((item) =>
            item.careAlertId ? [item.careAlertId] : [],
          ),
        ),
      ],
    };
    const sourceData = {
      counts: {
        tasks: tasks.length,
        metrics: metricResult.items.length,
        evaluations: evaluations.length,
        alerts: alerts.length,
        consultations: consultationResult.items.length,
      },
      references: {
        taskIds: tasks.map((item) => String(item._id)),
        metricIds: metricResult.items.map((item) => item.id),
        evaluationIds: evaluations.map((item) => String(item._id)),
        alertIds: alerts.map((item) => String(item._id)),
        consultationIds: consultationResult.items.map((item) => item.id),
      },
      revisions: {
        metrics: metricResult.items.map((item) => ({
          id: item.id,
          ingestedAt: item.ingestedAt,
        })),
      },
    };
    const inputHash = this.hash({
      enrollmentId,
      reportType,
      windowStart,
      windowEnd,
      dataUntil,
      facts,
      consultationSummary,
      sourceData,
    });
    const existing = await this.reports
      .findOne({
        patientCareProgramId: enrollment._id,
        reportType,
        windowStart,
        windowEnd,
        inputHash,
      })
      .exec();
    if (existing) return this.project(existing.toObject(), actor.role);

    const session = await this.connection.startSession();
    try {
      let report!: CareReportDocument;
      await session.withTransaction(async () => {
        const latest = await this.reports
          .findOne({
            patientCareProgramId: enrollment._id,
            reportType,
            windowStart,
            windowEnd,
          })
          .sort({ reportVersion: -1, _id: -1 })
          .session(session)
          .exec();
        if (latest?.inputHash === inputHash) {
          report = latest;
          return;
        }
        if (latest?.status === CareReportStatus.READY)
          await this.reports.updateOne(
            { _id: latest._id, status: CareReportStatus.READY },
            { $set: { status: CareReportStatus.SUPERSEDED } },
            { session },
          );
        [report] = await this.reports.create(
          [
            {
              patientCareProgramId: enrollment._id,
              patientId: enrollment.patientId,
              careRuleId: enrollment.careRuleId,
              reportType,
              dataFormatVersion: SUMMARY_INPUT_VERSION_V1,
              windowStart,
              windowEnd,
              timezone: enrollment.timezone,
              dataUntil,
              status: CareReportStatus.READY,
              ...facts,
              consultationSummary,
              sourceData,
              inputHash,
              reportVersion: (latest?.reportVersion ?? 0) + 1,
              ...(latest ? { replacesReportId: latest._id } : {}),
              generatedAt: new Date(),
            },
          ],
          { session },
        );
      });
      return this.project(report.toObject(), actor.role);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const replay = await this.reports
          .findOne({
            patientCareProgramId: enrollment._id,
            reportType,
            windowStart,
            windowEnd,
            inputHash,
          })
          .exec();
        if (replay) return this.project(replay.toObject(), actor.role);
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async list(
    actor: CareActor,
    enrollmentId: string,
    reportType?: CareReportType,
  ) {
    const enrollment = await this.enrollments
      .findById(this.objectId(enrollmentId))
      .select('_id patientId doctorId')
      .lean()
      .exec();
    if (!enrollment)
      this.fail(
        'CARE_ENROLLMENT_NOT_FOUND',
        HttpStatus.NOT_FOUND,
        'Enrollment not found',
      );
    this.authorize(actor, enrollment);
    const filter: Record<string, unknown> = {
      patientCareProgramId: enrollment._id,
    };
    if (reportType) filter.reportType = reportType;
    const reports = await this.reports
      .find(filter)
      .select(REPORT_PROJECTION)
      .sort({ generatedAt: -1, _id: -1 })
      .limit(100)
      .lean()
      .exec();
    return reports.map((report) => this.project(report, actor.role));
  }

  async get(actor: CareActor, reportId: string) {
    const report = await this.reports
      .findById(this.objectId(reportId))
      .select(REPORT_PROJECTION)
      .lean()
      .exec();
    if (!report)
      this.fail(
        'CARE_REPORT_NOT_FOUND',
        HttpStatus.NOT_FOUND,
        'Care report not found',
      );
    const enrollment = await this.enrollments
      .findById(report.patientCareProgramId)
      .select('patientId doctorId')
      .lean()
      .exec();
    if (!enrollment)
      this.fail(
        'CARE_REPORT_NOT_FOUND',
        HttpStatus.NOT_FOUND,
        'Care report not found',
      );
    this.authorize(actor, enrollment);
    return this.project(report, actor.role);
  }

  private project(report: CareReportReadModel, role: UserRole): CareReportView {
    const sourceData = report.sourceData;
    const patientEvaluationSummary = projectPatientHealthEvaluationSummary(
      report.healthEvaluationSummary,
    );
    const audience = role === UserRole.DOCTOR ? 'doctor' : 'patient';
    const summaryInput: SummaryInputV1 = {
      schemaVersion: SUMMARY_INPUT_VERSION_V1,
      reportId: String(report._id),
      audience,
      reportWindow: {
        start: new Date(report.windowStart).toISOString(),
        end: new Date(report.windowEnd).toISOString(),
        timezone: report.timezone,
        dataUntil: new Date(report.dataUntil).toISOString(),
      },
      facts: {
        statistics: report.statistics,
        trends: report.trends,
        missingData: report.missingData,
        healthEvaluations:
          role === UserRole.DOCTOR
            ? report.healthEvaluationSummary
            : patientEvaluationSummary,
        consultations: report.consultationSummary ?? null,
      },
      provenance: {
        inputHash: report.inputHash,
        reportVersion: report.reportVersion,
        sourceCounts: sourceData.counts ?? {},
        ...(role === UserRole.DOCTOR
          ? { sourceReferences: sourceData.references ?? {} }
          : {}),
      },
    };
    const {
      sourceData: _,
      healthEvaluationSummary: __,
      ...safeReport
    } = report;
    return {
      ...safeReport,
      ...(role === UserRole.DOCTOR
        ? {
            sourceData,
            healthEvaluationSummary: report.healthEvaluationSummary,
          }
        : {}),
      summaryInput,
    } as CareReportView;
  }
}
