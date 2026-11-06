import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { UserRole } from '../../../../core/domain/user.enums';
import { OutboxService } from '../../../../infrastructure/outbox/outbox.service';
import {
  CareReport,
  CareReportDocument,
} from '../../domain/entities/care-report.entity';
import {
  CareReportExport,
  CareReportExportDocument,
  CareReportExportFormat,
  CareReportExportStatus,
} from '../../domain/entities/care-report-export.entity';
import {
  PatientCareProgram,
  PatientCareProgramDocument,
  PatientCareProgramStatus,
} from '../../domain/entities/patient-care-program.entity';
import {
  CARE_PROGRAM_ACCESS_PORT,
  type CareProgramAccessPort,
} from '../ports/care-program-access.port';
import {
  CARE_REPORT_EXPORT_STORAGE,
  type CareReportExportStoragePort,
} from '../ports/care-report-export-storage.port';
import type { CareActor } from './care-program-rule.service';

const ACTIVE_ENROLLMENT_STATES = [
  PatientCareProgramStatus.PENDING,
  PatientCareProgramStatus.ACTIVE,
  PatientCareProgramStatus.PAUSED,
];

type CareReportExportRecord = Pick<
  CareReportExport,
  | 'careReportId'
  | 'reportVersion'
  | 'format'
  | 'status'
  | 'requestHash'
  | 'storageKey'
  | 'expiresAt'
  | 'failureReasonCode'
  | 'createdAt'
  | 'updatedAt'
> & { _id: Types.ObjectId };

@Injectable()
export class CareReportExportService {
  constructor(
    @InjectModel(CareReport.name)
    private readonly reports: Model<CareReportDocument>,
    @InjectModel(CareReportExport.name)
    private readonly exports: Model<CareReportExportDocument>,
    @InjectModel(PatientCareProgram.name)
    private readonly enrollments: Model<PatientCareProgramDocument>,
    @Inject(CARE_PROGRAM_ACCESS_PORT)
    private readonly access: CareProgramAccessPort,
    @Inject(CARE_REPORT_EXPORT_STORAGE)
    private readonly storage: CareReportExportStoragePort,
    private readonly outbox: OutboxService,
    private readonly config: ConfigService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  private fail(code: string, status: HttpStatus, message: string): never {
    throw new HttpException({ code, message }, status);
  }

  private objectId(value: string) {
    if (!Types.ObjectId.isValid(value))
      this.fail(
        'CARE_REPORT_EXPORT_NOT_FOUND',
        HttpStatus.NOT_FOUND,
        'Care report export not found',
      );
    return new Types.ObjectId(value);
  }

  private requiredPositiveConfig(key: string): number {
    const value = Number(this.config.get(key));
    if (!Number.isInteger(value) || value <= 0)
      this.fail(
        'CARE_REPORT_EXPORT_CONFIGURATION_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
        'Care report export is not configured',
      );
    return value;
  }

  private requestHash(reportId: string, format: CareReportExportFormat) {
    return createHash('sha256')
      .update(JSON.stringify({ reportId, format }))
      .digest('hex');
  }

  async create(
    actor: CareActor,
    reportId: string,
    format: CareReportExportFormat,
    idempotencyKey?: string,
  ) {
    if (!idempotencyKey?.trim())
      this.fail(
        'IDEMPOTENCY_KEY_REQUIRED',
        HttpStatus.BAD_REQUEST,
        'Idempotency-Key is required',
      );
    if (idempotencyKey.length > 200)
      this.fail(
        'IDEMPOTENCY_KEY_INVALID',
        HttpStatus.BAD_REQUEST,
        'Idempotency-Key is invalid',
      );
    this.requiredPositiveConfig('CARE_REPORT_EXPORT_ARTIFACT_TTL_MINUTES');
    this.requiredPositiveConfig('CARE_REPORT_EXPORT_SIGNED_URL_TTL_SECONDS');

    const report = await this.reports
      .findById(this.objectId(reportId))
      .select('_id patientCareProgramId patientId reportVersion inputHash')
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
      .select('_id patientId doctorId status programConfig')
      .lean()
      .exec();
    if (!enrollment)
      this.fail(
        'CARE_REPORT_NOT_FOUND',
        HttpStatus.NOT_FOUND,
        'Care report not found',
      );
    const participantId =
      actor.role === UserRole.PATIENT
        ? String(enrollment.patientId)
        : actor.role === UserRole.DOCTOR
          ? String(enrollment.doctorId)
          : null;
    if (participantId !== actor.id)
      this.fail(
        'CARE_REPORT_EXPORT_NOT_FOUND',
        HttpStatus.NOT_FOUND,
        'Care report export not found',
      );

    const programCode = enrollment.programConfig.programCode;
    if (typeof programCode !== 'string' || !programCode)
      this.fail(
        'CARE_REPORT_EXPORT_ENTITLEMENT_UNAVAILABLE',
        HttpStatus.CONFLICT,
        'Care report export entitlement is unavailable',
      );
    const activeProgramCount = await this.enrollments.countDocuments({
      patientId: enrollment.patientId,
      _id: { $ne: enrollment._id },
      status: { $in: ACTIVE_ENROLLMENT_STATES },
    });
    const entitlement = await this.access.check({
      patientId: String(enrollment.patientId),
      programCode,
      activeProgramCount,
    });
    if (!entitlement.eligible)
      this.fail(
        'CARE_REPORT_EXPORT_NOT_ENTITLED',
        HttpStatus.FORBIDDEN,
        'Care report export is not included in the current entitlement',
      );

    const hash = this.requestHash(String(report._id), format);
    const existing = await this.exports
      .findOne({ ownerId: new Types.ObjectId(actor.id), idempotencyKey })
      .lean()
      .exec();
    if (existing) {
      if (existing.requestHash !== hash)
        this.fail(
          'IDEMPOTENCY_KEY_CONFLICT',
          HttpStatus.CONFLICT,
          'Idempotency-Key was reused with another payload',
        );
      return this.project(existing, true);
    }

    const exportId = new Types.ObjectId();
    try {
      await this.connection.transaction(async (session) => {
        await this.exports.create(
          [
            {
              _id: exportId,
              careReportId: report._id,
              patientCareProgramId: report.patientCareProgramId,
              reportVersion: report.reportVersion,
              inputHash: report.inputHash,
              ownerId: new Types.ObjectId(actor.id),
              audience: actor.role === UserRole.DOCTOR ? 'doctor' : 'patient',
              format,
              status: CareReportExportStatus.PENDING,
              idempotencyKey,
              requestHash: hash,
              rendererVersion: 'care-report-export.v1',
              attemptCount: 0,
            },
          ],
          { session },
        );
        await this.outbox.enqueue(
          {
            eventType: 'care.report.export.requested.v1',
            aggregateType: 'careReportExport',
            aggregateId: exportId,
            idempotencyKey: `care.report.export.render.${String(exportId)}`,
            payload: { eventVersion: 1, exportId: String(exportId) },
          },
          session,
        );
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const replay = await this.exports
        .findOne({ ownerId: new Types.ObjectId(actor.id), idempotencyKey })
        .lean()
        .exec();
      if (!replay || replay.requestHash !== hash)
        this.fail(
          'IDEMPOTENCY_KEY_CONFLICT',
          HttpStatus.CONFLICT,
          'Idempotency-Key was reused with another payload',
        );
      return this.project(replay, true);
    }
    const created = await this.exports.findById(exportId).lean().exec();
    if (!created)
      this.fail(
        'CARE_REPORT_EXPORT_NOT_FOUND',
        HttpStatus.NOT_FOUND,
        'Care report export not found',
      );
    return this.project(created, false);
  }

  async get(actor: CareActor, exportId: string) {
    const record = await this.exports
      .findOne({
        _id: this.objectId(exportId),
        ownerId: new Types.ObjectId(actor.id),
      })
      .lean()
      .exec();
    if (!record)
      this.fail(
        'CARE_REPORT_EXPORT_NOT_FOUND',
        HttpStatus.NOT_FOUND,
        'Care report export not found',
      );
    return this.project(record, false, true);
  }

  private async project(
    record: CareReportExportRecord,
    replayed: boolean,
    withDownload = false,
  ) {
    const expired =
      record.expiresAt && new Date(record.expiresAt) <= new Date();
    const status = expired ? CareReportExportStatus.EXPIRED : record.status;
    const result: Record<string, unknown> = {
      id: String(record._id),
      careReportId: String(record.careReportId),
      reportVersion: record.reportVersion,
      format: record.format,
      status,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
      replayed,
      ...(record.expiresAt
        ? { expiresAt: new Date(record.expiresAt).toISOString() }
        : {}),
      ...(record.failureReasonCode
        ? { failureReasonCode: record.failureReasonCode }
        : {}),
    };
    if (
      withDownload &&
      status === CareReportExportStatus.READY &&
      record.storageKey &&
      record.expiresAt
    ) {
      const seconds = this.requiredPositiveConfig(
        'CARE_REPORT_EXPORT_SIGNED_URL_TTL_SECONDS',
      );
      const expiresAt = new Date(
        Math.min(
          Date.now() + seconds * 1000,
          new Date(record.expiresAt).getTime(),
        ),
      );
      result.download = {
        url: await this.storage.createSignedDownload({
          key: record.storageKey,
          filename: `care-report-${record.reportVersion}.${record.format}`,
          expiresAt,
        }),
        expiresAt: expiresAt.toISOString(),
      };
    }
    return result;
  }
}
