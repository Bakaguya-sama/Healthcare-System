import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '../../../../core/domain/user.enums';
import type { PageResult } from '../../../../common/pagination';
import {
  CARE_IDENTITY_READER_PORT,
  type CareIdentityReaderPort,
  type CareIdentitySummary,
} from '../ports/care-identity-reader.port';
import {
  DOCTOR_REPOSITORY_PORT,
  type DoctorRepositoryPort,
} from '../ports/doctor.repository.port';
import {
  PATIENT_REPOSITORY_PORT,
  type PatientRepositoryPort,
} from '../ports/patient.repository.port';
import {
  CareProgram,
  CareProgramDocument,
  CareProgramStatus,
} from '../../domain/entities/care-program.entity';
import {
  PatientCareProgram,
  PatientCareProgramDocument,
  PatientCareProgramStatus,
} from '../../domain/entities/patient-care-program.entity';
import {
  CareTask,
  CareTaskDocument,
  CareTaskStatus,
} from '../../domain/entities/care-task.entity';
import {
  CareAlert,
  CareAlertDocument,
  CareAlertStatus,
} from '../../domain/entities/care-alert.entity';
import {
  CareReport,
  CareReportDocument,
  CareReportStatus,
} from '../../domain/entities/care-report.entity';
import type { CareActor } from './care-program-rule.service';
import type {
  QueryCareEnrollmentsDto,
  QueryCareProgramsDto,
} from '../../presentation/dto/chronic-care-read.dto';

type PlainRecord = Record<string, unknown> & { _id: Types.ObjectId };

@Injectable()
export class ChronicCareReadService {
  constructor(
    @InjectModel(CareProgram.name)
    private readonly programs: Model<CareProgramDocument>,
    @InjectModel(PatientCareProgram.name)
    private readonly enrollments: Model<PatientCareProgramDocument>,
    @InjectModel(CareTask.name)
    private readonly tasks: Model<CareTaskDocument>,
    @InjectModel(CareAlert.name)
    private readonly alerts: Model<CareAlertDocument>,
    @InjectModel(CareReport.name)
    private readonly reports: Model<CareReportDocument>,
    @Inject(PATIENT_REPOSITORY_PORT)
    private readonly patients: PatientRepositoryPort,
    @Inject(DOCTOR_REPOSITORY_PORT)
    private readonly doctors: DoctorRepositoryPort,
    @Inject(CARE_IDENTITY_READER_PORT)
    private readonly identities: CareIdentityReaderPort,
  ) {}

  async listPrograms(
    actor: CareActor,
    query: QueryCareProgramsDto,
  ): Promise<PageResult<Record<string, unknown>>> {
    await this.assertCatalogActor(actor);
    if (
      actor.role !== UserRole.ADMIN &&
      query.status &&
      query.status !== CareProgramStatus.PUBLISHED
    ) {
      return {
        items: [],
        page: query.page,
        limit: query.limit,
        total: 0,
        totalPages: 0,
      };
    }
    const filter: Record<string, unknown> = {};
    if (actor.role !== UserRole.ADMIN)
      filter.status = CareProgramStatus.PUBLISHED;
    else if (query.status) filter.status = query.status;
    if (query.diseaseKey) filter.diseaseKey = query.diseaseKey;

    const sort: Record<string, 1 | -1> = {
      [query.sortBy]: query.sortOrder,
      _id: query.sortOrder,
    };
    const skip = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.programs
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(query.limit)
        .lean()
        .exec(),
      this.programs.countDocuments(filter).exec(),
    ]);
    return {
      items: rows.map((row) =>
        this.programSummary(row as unknown as PlainRecord),
      ),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getProgram(
    actor: CareActor,
    id: string,
  ): Promise<Record<string, unknown>> {
    await this.assertCatalogActor(actor);
    const objectId = this.objectId(id, 'CARE_PROGRAM_NOT_FOUND');
    const filter: Record<string, unknown> = { _id: objectId };
    if (actor.role !== UserRole.ADMIN)
      filter.status = CareProgramStatus.PUBLISHED;
    const row = await this.programs.findOne(filter).lean().exec();
    if (!row) this.notFound('CARE_PROGRAM_NOT_FOUND', 'Care Program not found');
    const program = row as unknown as PlainRecord;
    const detail: Record<string, unknown> = {
      ...this.programSummary(program),
      eligibilityForm: program.eligibilityForm,
      contentJourney: program.contentJourney,
    };
    if (actor.role === UserRole.DOCTOR || actor.role === UserRole.ADMIN) {
      Object.assign(detail, {
        baselineForm: program.baselineForm,
        taskTemplates: program.taskTemplates,
        reminderPolicy: program.reminderPolicy,
        reviewPolicy: program.reviewPolicy,
        completionCriteria: program.completionCriteria,
        doctorEditableFields: program.doctorEditableFields,
        dataSources: program.dataSources,
      });
    }
    if (actor.role === UserRole.ADMIN) {
      Object.assign(detail, {
        revision: program.revision,
        createdBy: this.stringId(program.createdBy),
        publishedBy: this.stringId(program.publishedBy),
        retiredBy: this.stringId(program.retiredBy),
        createdAt: this.iso(program.createdAt),
        updatedAt: this.iso(program.updatedAt),
      });
    }
    return detail;
  }

  async listEnrollments(
    actor: CareActor,
    query: QueryCareEnrollmentsDto,
  ): Promise<PageResult<Record<string, unknown>>> {
    const actorId = this.objectId(actor.id, 'CARE_FORBIDDEN');
    const filter: Record<string, unknown> = {};
    if (actor.role === UserRole.PATIENT) {
      if (!(await this.patients.isActive(actor.id))) this.forbidden();
      if (query.patientId && query.patientId !== actor.id) this.forbidden();
      filter.patientId = actorId;
    } else if (actor.role === UserRole.DOCTOR) {
      if (!(await this.doctors.isActiveAndApproved(actor.id))) this.forbidden();
      filter.doctorId = actorId;
      if (query.patientId)
        filter.patientId = this.objectId(query.patientId, 'CARE_FORBIDDEN');
    } else {
      this.forbidden();
    }
    if (query.status) filter.status = query.status;
    if (query.programCode) {
      const programIds = await this.programs.distinct('_id', {
        programCode: query.programCode,
      });
      filter.careProgramId = { $in: programIds };
    }
    const sort: Record<string, 1 | -1> = {
      [query.sortBy]: query.sortOrder,
      _id: query.sortOrder,
    };
    const skip = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.enrollments
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(query.limit)
        .lean()
        .exec(),
      this.enrollments.countDocuments(filter).exec(),
    ]);
    const items = await this.enrollmentSummaries(
      actor,
      rows as unknown as PlainRecord[],
    );
    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getEnrollment(
    actor: CareActor,
    id: string,
  ): Promise<Record<string, unknown>> {
    const actorId = this.objectId(actor.id, 'CARE_ENROLLMENT_NOT_FOUND');
    const filter: Record<string, unknown> = {
      _id: this.objectId(id, 'CARE_ENROLLMENT_NOT_FOUND'),
    };
    if (actor.role === UserRole.PATIENT) {
      if (!(await this.patients.isActive(actor.id)))
        this.notFound('CARE_ENROLLMENT_NOT_FOUND', 'Care Enrollment not found');
      filter.patientId = actorId;
    } else if (actor.role === UserRole.DOCTOR) {
      if (!(await this.doctors.isActiveAndApproved(actor.id)))
        this.notFound('CARE_ENROLLMENT_NOT_FOUND', 'Care Enrollment not found');
      filter.doctorId = actorId;
    } else {
      this.notFound('CARE_ENROLLMENT_NOT_FOUND', 'Care Enrollment not found');
    }
    const row = await this.enrollments.findOne(filter).lean().exec();
    if (!row)
      this.notFound('CARE_ENROLLMENT_NOT_FOUND', 'Care Enrollment not found');
    const enrollment = row as unknown as PlainRecord;
    const [summary] = await this.enrollmentSummaries(actor, [enrollment]);
    const [taskSummary, alertSummary, latestReport] = await Promise.all([
      this.taskSummary(enrollment._id),
      this.alertSummary(enrollment._id),
      this.latestReport(enrollment._id),
    ]);
    return {
      ...summary,
      consent: this.safeConsent(enrollment.consent),
      baseline: enrollment.baselineAnswers
        ? {
            answers: enrollment.baselineAnswers,
            completedAt: this.iso(enrollment.baselineCompletedAt),
          }
        : undefined,
      taskSummary,
      alertSummary,
      latestReport,
    };
  }

  private async enrollmentSummaries(actor: CareActor, rows: PlainRecord[]) {
    if (!rows.length) return [];
    const programIds = [
      ...new Set(
        rows.map((row) => this.stringId(row.careProgramId)).filter(Boolean),
      ),
    ];
    const identityIds = rows
      .flatMap((row) => [
        this.stringId(row.patientId),
        this.stringId(row.doctorId),
      ])
      .filter((value): value is string => Boolean(value));
    const [programs, identities] = await Promise.all([
      this.programs
        .find({ _id: { $in: programIds.map((id) => new Types.ObjectId(id)) } })
        .lean()
        .exec(),
      this.identities.findSafeSummaries(identityIds),
    ]);
    const programMap = new Map(
      programs.map((program) => [
        String(program._id),
        this.programSummary(program as unknown as PlainRecord),
      ]),
    );
    const identityMap = new Map(
      identities.map((identity) => [identity.id, identity]),
    );
    return rows.map((row) => {
      const result: Record<string, unknown> = {
        id: String(row._id),
        program: programMap.get(this.stringId(row.careProgramId) || '') || null,
        status: row.status,
        timezone: row.timezone,
        allowedActions: this.allowedActions(
          actor.role,
          row.status as PatientCareProgramStatus,
          this.hasConsent(row.consent),
          Boolean(row.baselineCompletedAt),
        ),
        startedAt: this.iso(row.startedAt),
        expectedEndAt: this.iso(row.expectedEndAt),
        createdAt: this.iso(row.createdAt),
        updatedAt: this.iso(row.updatedAt),
      };
      if (actor.role === UserRole.PATIENT)
        result.assignedDoctor = this.safeIdentity(
          identityMap.get(this.stringId(row.doctorId) || ''),
        );
      if (actor.role === UserRole.DOCTOR)
        result.patient = this.safeIdentity(
          identityMap.get(this.stringId(row.patientId) || ''),
        );
      return result;
    });
  }

  private async taskSummary(enrollmentId: Types.ObjectId) {
    const [counts, next] = await Promise.all([
      this.tasks.aggregate<{ _id: string; count: number }>([
        { $match: { patientCareProgramId: enrollmentId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.tasks
        .findOne({
          patientCareProgramId: enrollmentId,
          status: { $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE] },
        })
        .sort({ windowStart: 1, _id: 1 })
        .select('_id taskType status scheduledFor windowStart windowEnd')
        .lean()
        .exec(),
    ]);
    const byStatus = Object.fromEntries(
      counts.map((item) => [item._id, item.count]),
    );
    const completed = byStatus[CareTaskStatus.COMPLETED] || 0;
    const missed = byStatus[CareTaskStatus.MISSED] || 0;
    return {
      counts: byStatus,
      adherencePercent:
        completed + missed
          ? Math.round((completed / (completed + missed)) * 100)
          : null,
      next: next
        ? {
            id: String(next._id),
            taskType: next.taskType,
            status: next.status,
            scheduledFor: this.iso(next.scheduledFor),
            windowStart: this.iso(next.windowStart),
            windowEnd: this.iso(next.windowEnd),
          }
        : null,
    };
  }

  private async alertSummary(enrollmentId: Types.ObjectId) {
    const [openCount, latest] = await Promise.all([
      this.alerts.countDocuments({
        patientCareProgramId: enrollmentId,
        status: { $in: [CareAlertStatus.OPEN, CareAlertStatus.ACKNOWLEDGED] },
      }),
      this.alerts
        .findOne({ patientCareProgramId: enrollmentId })
        .sort({ detectedAt: -1, _id: -1 })
        .select('_id severity status detectedAt')
        .lean()
        .exec(),
    ]);
    return {
      openCount,
      latest: latest
        ? {
            id: String(latest._id),
            severity: latest.severity,
            status: latest.status,
            detectedAt: this.iso(latest.detectedAt),
          }
        : null,
    };
  }

  private async latestReport(enrollmentId: Types.ObjectId) {
    const report = await this.reports
      .findOne({
        patientCareProgramId: enrollmentId,
        status: CareReportStatus.READY,
      })
      .sort({ generatedAt: -1, _id: -1 })
      .select(
        '_id reportType status generatedAt reportVersion dataFormatVersion',
      )
      .lean()
      .exec();
    return report
      ? {
          id: String(report._id),
          reportType: report.reportType,
          status: report.status,
          generatedAt: this.iso(report.generatedAt),
          reportVersion: report.reportVersion,
          dataFormatVersion: report.dataFormatVersion,
        }
      : null;
  }

  private programSummary(program: PlainRecord): Record<string, unknown> {
    return {
      id: String(program._id),
      programCode: program.programCode,
      version: program.version,
      name: program.name,
      diseaseKey: program.diseaseKey,
      description: program.description,
      status: program.status,
      publishedAt: this.iso(program.publishedAt),
      retiredAt: this.iso(program.retiredAt),
    };
  }

  private safeIdentity(identity?: CareIdentitySummary) {
    if (!identity) return null;
    return {
      id: identity.id,
      fullName: identity.fullName,
      avatarUrl: identity.avatarUrl,
      specialty: identity.specialty,
    };
  }

  private safeConsent(value: unknown) {
    if (!value || typeof value !== 'object') return undefined;
    const consent = value as Record<string, unknown>;
    return {
      policyVersion: consent.policyVersion,
      purposes: consent.purposes,
      acceptedAt: consent.acceptedAt,
    };
  }

  private allowedActions(
    role: UserRole,
    status: PatientCareProgramStatus,
    hasConsent: boolean,
    hasBaseline: boolean,
  ): string[] {
    if (role === UserRole.PATIENT) {
      if (status === PatientCareProgramStatus.PENDING)
        return [
          ...(hasConsent ? [] : ['submit_consent']),
          ...(hasBaseline ? [] : ['submit_baseline']),
          ...(hasConsent ? ['withdraw_consent'] : []),
        ];
      return [
        PatientCareProgramStatus.ACTIVE,
        PatientCareProgramStatus.PAUSED,
      ].includes(status)
        ? ['withdraw_consent']
        : [];
    }
    if (status === PatientCareProgramStatus.PENDING) return ['cancel'];
    if (status === PatientCareProgramStatus.ACTIVE)
      return ['pause', 'complete', 'cancel'];
    if (status === PatientCareProgramStatus.PAUSED)
      return ['resume', 'complete', 'cancel'];
    return [];
  }

  private hasConsent(value: unknown): boolean {
    return Boolean(
      value &&
      typeof value === 'object' &&
      (value as Record<string, unknown>).acceptedAt,
    );
  }

  private async assertCatalogActor(actor: CareActor) {
    if (
      actor.role === UserRole.PATIENT &&
      !(await this.patients.isActive(actor.id))
    )
      this.forbidden();
    if (
      actor.role === UserRole.DOCTOR &&
      !(await this.doctors.isActiveAndApproved(actor.id))
    )
      this.forbidden();
    if (
      ![UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN].includes(actor.role)
    )
      this.forbidden();
  }

  private objectId(value: string, code: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value))
      this.notFound(
        code,
        code === 'CARE_PROGRAM_NOT_FOUND'
          ? 'Care Program not found'
          : 'Care Enrollment not found',
      );
    return new Types.ObjectId(value);
  }

  private iso(value: unknown): string | undefined {
    if (!value) return undefined;
    if (
      !(value instanceof Date) &&
      typeof value !== 'string' &&
      typeof value !== 'number'
    )
      return undefined;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private stringId(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (value instanceof Types.ObjectId) return value.toHexString();
    return undefined;
  }

  private forbidden(): never {
    throw new HttpException(
      { code: 'CARE_FORBIDDEN', message: 'Care resource is not accessible' },
      HttpStatus.FORBIDDEN,
    );
  }

  private notFound(code: string, message: string): never {
    throw new HttpException({ code, message }, HttpStatus.NOT_FOUND);
  }
}
