import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
  CARE_REPORT_EXPORT_STORAGE,
  type CareReportExportStoragePort,
} from '../ports/care-report-export-storage.port';
import {
  CareReportExportProjection,
  renderCareReportCsv,
  renderCareReportPdf,
} from '../../domain/reports/care-report-export-renderer';

const REPORT_FIELDS =
  '_id patientCareProgramId reportType status windowStart windowEnd timezone dataUntil statistics trends missingData healthEvaluationSummary consultationSummary sourceData inputHash reportVersion generatedAt';

function safeValue(value: unknown, depth = 0): unknown {
  if (depth > 8) throw new Error('CARE_REPORT_EXPORT_PROJECTION_UNAVAILABLE');
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    if (value.length > 500)
      throw new Error('CARE_REPORT_EXPORT_PROJECTION_UNAVAILABLE');
    return value.map((item) => safeValue(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 500)
      throw new Error('CARE_REPORT_EXPORT_PROJECTION_UNAVAILABLE');
    return Object.fromEntries(
      entries.map(([key, item]) => {
        if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(key))
          throw new Error('CARE_REPORT_EXPORT_PROJECTION_UNAVAILABLE');
        return [key, safeValue(item, depth + 1)];
      }),
    );
  }
  throw new Error('CARE_REPORT_EXPORT_PROJECTION_UNAVAILABLE');
}

function numbers(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (item): item is [string, number] =>
        typeof item[1] === 'number' && Number.isFinite(item[1]),
    ),
  );
}

@Injectable()
export class CareReportExportProcessorService {
  constructor(
    @InjectModel(CareReport.name)
    private readonly reports: Model<CareReportDocument>,
    @InjectModel(CareReportExport.name)
    private readonly exports: Model<CareReportExportDocument>,
    @Inject(CARE_REPORT_EXPORT_STORAGE)
    private readonly storage: CareReportExportStoragePort,
    private readonly config: ConfigService,
  ) {}

  private requiredConfig(key: string) {
    const value = Number(this.config.get(key));
    if (!Number.isInteger(value) || value <= 0)
      throw new Error('CARE_REPORT_EXPORT_CONFIGURATION_UNAVAILABLE');
    return value;
  }

  async process(exportId: string, finalAttempt: boolean) {
    if (!Types.ObjectId.isValid(exportId))
      throw new Error('Invalid care report export event');
    const now = new Date();
    const leaseOwner = randomUUID();
    const record = await this.exports
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(exportId),
          $or: [
            { status: CareReportExportStatus.PENDING },
            {
              status: CareReportExportStatus.PROCESSING,
              leaseExpiresAt: { $lte: now },
            },
          ],
        },
        {
          $set: {
            status: CareReportExportStatus.PROCESSING,
            leaseOwner,
            leaseExpiresAt: new Date(now.getTime() + 5 * 60_000),
          },
          $inc: { attemptCount: 1 },
          $unset: { failureReasonCode: '' },
        },
        { new: true },
      )
      .lean()
      .exec();
    if (!record) {
      const existing = await this.exports
        .findById(exportId)
        .select('status')
        .lean()
        .exec();
      if (
        existing?.status === CareReportExportStatus.READY ||
        existing?.status === CareReportExportStatus.EXPIRED
      )
        return;
      throw new Error('CARE_REPORT_EXPORT_NOT_CLAIMABLE');
    }

    try {
      const report = await this.reports
        .findById(record.careReportId)
        .select(REPORT_FIELDS)
        .lean()
        .exec();
      if (
        !report ||
        report.reportVersion !== record.reportVersion ||
        report.inputHash !== record.inputHash
      )
        throw new Error('CARE_REPORT_EXPORT_REPORT_SNAPSHOT_MISMATCH');
      const sourceData = safeValue(report.sourceData) as {
        counts?: unknown;
        references?: unknown;
      };
      const fullEvaluation = safeValue(
        report.healthEvaluationSummary,
      ) as Record<string, unknown>;
      const projection: CareReportExportProjection = {
        schemaVersion: 'care-report-export.v1',
        audience: record.audience,
        report: {
          id: String(report._id),
          type: String(report.reportType),
          version: report.reportVersion,
          status: String(report.status),
          windowStart: new Date(report.windowStart).toISOString(),
          windowEnd: new Date(report.windowEnd).toISOString(),
          timezone: report.timezone,
          dataUntil: new Date(report.dataUntil).toISOString(),
          generatedAt: new Date(report.generatedAt).toISOString(),
        },
        statistics: safeValue(report.statistics) as Record<string, unknown>,
        trends: safeValue(report.trends) as Record<string, unknown>,
        missingData: safeValue(report.missingData) as unknown[],
        healthEvaluationSummary:
          record.audience === 'doctor'
            ? fullEvaluation
            : {
                total:
                  typeof fullEvaluation.total === 'number'
                    ? fullEvaluation.total
                    : 0,
                bySeverity: numbers(fullEvaluation.bySeverity),
              },
        consultationSummary: report.consultationSummary
          ? (safeValue(report.consultationSummary) as Record<string, unknown>)
          : null,
        provenance: {
          inputHash: report.inputHash,
          sourceCounts: numbers(sourceData.counts),
          ...(record.audience === 'doctor' && sourceData.references
            ? {
                sourceReferences: safeValue(sourceData.references) as Record<
                  string,
                  string[]
                >,
              }
            : {}),
        },
      };
      const body =
        record.format === CareReportExportFormat.PDF
          ? renderCareReportPdf(projection)
          : renderCareReportCsv(projection);
      const key = `healthcare/care-report-exports/${String(record._id)}/report.${record.format}`;
      const mimeType =
        record.format === CareReportExportFormat.PDF
          ? 'application/pdf'
          : 'text/csv; charset=utf-8';
      const uploaded = await this.storage.put({ key, body, mimeType });
      const ttlMinutes = this.requiredConfig(
        'CARE_REPORT_EXPORT_ARTIFACT_TTL_MINUTES',
      );
      const updated = await this.exports
        .updateOne(
          {
            _id: record._id,
            status: CareReportExportStatus.PROCESSING,
            leaseOwner,
          },
          {
            $set: {
              status: CareReportExportStatus.READY,
              storageKey: key,
              mimeType,
              byteSize: uploaded.byteSize,
              checksum: createHash('sha256').update(body).digest('hex'),
              expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
            },
            $unset: {
              leaseOwner: '',
              leaseExpiresAt: '',
              failureReasonCode: '',
            },
          },
        )
        .exec();
      if (updated.modifiedCount !== 1)
        throw new Error('CARE_REPORT_EXPORT_LOST_LEASE');
    } catch (error) {
      await this.exports
        .updateOne(
          {
            _id: record._id,
            status: CareReportExportStatus.PROCESSING,
            leaseOwner,
          },
          {
            $set: {
              status: finalAttempt
                ? CareReportExportStatus.FAILED
                : CareReportExportStatus.PENDING,
              failureReasonCode:
                error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
                  ? error.message.slice(0, 100)
                  : 'CARE_REPORT_EXPORT_RENDER_FAILED',
            },
            $unset: { leaseOwner: '', leaseExpiresAt: '' },
          },
        )
        .exec();
      throw error;
    }
  }

  async cleanupExpired(limit = 100) {
    const records = await this.exports
      .find({
        status: {
          $in: [CareReportExportStatus.READY, CareReportExportStatus.EXPIRED],
        },
        expiresAt: { $lte: new Date() },
        storageKey: { $exists: true },
      })
      .select('_id status storageKey')
      .sort({ expiresAt: 1, _id: 1 })
      .limit(limit)
      .lean()
      .exec();
    for (const record of records) {
      await this.exports
        .updateOne(
          {
            _id: record._id,
            status: {
              $in: [
                CareReportExportStatus.READY,
                CareReportExportStatus.EXPIRED,
              ],
            },
          },
          { $set: { status: CareReportExportStatus.EXPIRED } },
        )
        .exec();
      try {
        await this.storage.delete(record.storageKey!);
        await this.exports
          .updateOne(
            { _id: record._id, status: CareReportExportStatus.EXPIRED },
            { $unset: { storageKey: '' } },
          )
          .exec();
      } catch {
        // Keep the private storage key for the next bounded cleanup retry.
      }
    }
  }
}
