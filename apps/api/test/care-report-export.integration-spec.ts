import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ObjectId } from 'mongodb';
import { Connection, createConnection } from 'mongoose';
import { UserRole } from '../src/core/domain/user.enums';
import { applyRf9Outbox } from '../src/database/migrations/202609182500-rf9-outbox';
import { applyCareReportExports } from '../src/database/migrations/202611061000-care-report-exports';
import {
  OutboxEvent,
  OutboxEventSchema,
} from '../src/infrastructure/outbox/entities/outbox-event.entity';
import { OutboxService } from '../src/infrastructure/outbox/outbox.service';
import { CareReportExportProcessorService } from '../src/modules/chronic-care/application/services/care-report-export-processor.service';
import { CareReportExportService } from '../src/modules/chronic-care/application/services/care-report-export.service';
import type { CareReportExportStoragePort } from '../src/modules/chronic-care/application/ports/care-report-export-storage.port';
import {
  CareReportExport,
  CareReportExportFormat,
  CareReportExportSchema,
} from '../src/modules/chronic-care/domain/entities/care-report-export.entity';
import {
  CareReport,
  CareReportSchema,
} from '../src/modules/chronic-care/domain/entities/care-report.entity';
import {
  PatientCareProgram,
  PatientCareProgramSchema,
} from '../src/modules/chronic-care/domain/entities/patient-care-program.entity';

jest.setTimeout(30_000);
const baseMongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_export_test?replicaSet=rs0&directConnection=true';

describe('CARE-31/32 CareReport export', () => {
  let connection: Connection;
  let service: CareReportExportService;
  let processor: CareReportExportProcessorService;
  const patientId = new ObjectId();
  const doctorId = new ObjectId();
  const reportId = new ObjectId();
  const enrollmentId = new ObjectId();
  const objects = new Map<string, Buffer>();
  const storage: CareReportExportStoragePort = {
    put: ({ key, body }) => {
      objects.set(key, body);
      return Promise.resolve({ byteSize: body.length });
    },
    createSignedDownload: ({ key, expiresAt }) =>
      Promise.resolve(
        `https://private.invalid/${key}?expires=${expiresAt.getTime()}`,
      ),
    delete: (key) => {
      objects.delete(key);
      return Promise.resolve();
    },
  };

  beforeAll(async () => {
    const uri = new URL(baseMongoUri);
    uri.pathname = `/healthcare_export_${new ObjectId().toHexString()}`;
    connection = await createConnection(uri.toString(), {
      autoIndex: false,
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    await applyRf9Outbox(connection.db!);
    await applyCareReportExports(connection.db!);
    const reports = connection.model(CareReport.name, CareReportSchema);
    const exportsModel = connection.model(
      CareReportExport.name,
      CareReportExportSchema,
    );
    const enrollments = connection.model(
      PatientCareProgram.name,
      PatientCareProgramSchema,
    );
    const outboxModel = connection.model(OutboxEvent.name, OutboxEventSchema);
    await enrollments.create({
      _id: enrollmentId,
      revision: 1,
      patientId,
      doctorId,
      careProgramId: new ObjectId(),
      careRuleId: new ObjectId(),
      programAccessSlot: 0,
      status: 'active',
      timezone: 'Asia/Saigon',
      consent: { version: 'v1' },
      programConfig: { programCode: 'diabetes-v1' },
      createdBy: doctorId,
    });
    await reports.create({
      _id: reportId,
      patientCareProgramId: enrollmentId,
      patientId,
      careRuleId: new ObjectId(),
      reportType: 'weekly',
      dataFormatVersion: 'v1',
      windowStart: new Date('2026-11-01T00:00:00Z'),
      windowEnd: new Date('2026-11-08T00:00:00Z'),
      timezone: 'Asia/Saigon',
      dataUntil: new Date('2026-11-08T00:00:00Z'),
      status: 'ready',
      statistics: { tasks: { completed: 3 } },
      trends: { direction: 'stable' },
      missingData: [],
      healthEvaluationSummary: {
        total: 1,
        bySeverity: { normal: 1 },
        evaluationIds: ['private'],
      },
      consultationSummary: { total: 1 },
      sourceData: {
        counts: { metrics: 2 },
        references: { metricIds: ['private-id'] },
      },
      inputHash: 'a'.repeat(64),
      reportVersion: 1,
      generatedAt: new Date('2026-11-08T00:01:00Z'),
    });
    const config = {
      get: (key: string) =>
        key === 'CARE_REPORT_EXPORT_ARTIFACT_TTL_MINUTES'
          ? 60
          : key === 'CARE_REPORT_EXPORT_SIGNED_URL_TTL_SECONDS'
            ? 120
            : undefined,
    } as ConfigService;
    const access = {
      check: () =>
        Promise.resolve({ eligible: true as const, activeCareProgramLimit: 3 }),
    };
    service = new CareReportExportService(
      reports as never,
      exportsModel as never,
      enrollments as never,
      access,
      storage,
      new OutboxService(outboxModel as never),
      config,
      connection,
    );
    processor = new CareReportExportProcessorService(
      reports as never,
      exportsModel as never,
      storage,
      config,
    );
  });

  afterAll(async () => {
    if (connection) {
      await connection.dropDatabase();
      await connection.close();
    }
  });

  it('atomically replays concurrent identical requests and rejects key reuse with another format', async () => {
    const actor = { id: patientId.toHexString(), role: UserRole.PATIENT };
    const [first, second] = await Promise.all([
      service.create(
        actor,
        reportId.toHexString(),
        CareReportExportFormat.CSV,
        'same-key',
      ),
      service.create(
        actor,
        reportId.toHexString(),
        CareReportExportFormat.CSV,
        'same-key',
      ),
    ]);
    expect(first.id).toBe(second.id);
    expect(
      await connection.db!.collection('carereportexports').countDocuments(),
    ).toBe(1);
    expect(
      await connection.db!.collection('outboxevents').countDocuments(),
    ).toBe(1);
    await expect(
      service.create(
        actor,
        reportId.toHexString(),
        CareReportExportFormat.PDF,
        'same-key',
      ),
    ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_CONFLICT' } });
  });

  it('renders the immutable patient projection and returns a signed URL only to its owner', async () => {
    const actor = { id: patientId.toHexString(), role: UserRole.PATIENT };
    const created = await service.create(
      actor,
      reportId.toHexString(),
      CareReportExportFormat.PDF,
      'pdf-key',
    );
    await processor.process(created.id as string, false);
    const ready = (await service.get(actor, created.id as string)) as {
      status: string;
      download: { url: string };
    };
    expect(ready.status).toBe('ready');
    expect(ready.download.url).toContain('https://private.invalid/');
    expect(ready).not.toHaveProperty('storageKey');
    expect(ready).not.toHaveProperty('checksum');
    const artifact = [...objects.values()].find(
      (value) => value.subarray(0, 8).toString('latin1') === '%PDF-1.4',
    );
    expect(artifact).toBeDefined();
    expect(artifact!.toString('latin1')).not.toContain('private-id');
    await expect(
      service.get(
        { id: new ObjectId().toHexString(), role: UserRole.PATIENT },
        created.id as string,
      ),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('keeps Doctor export audience-specific and denies Admin at the participant boundary', async () => {
    const doctor = { id: doctorId.toHexString(), role: UserRole.DOCTOR };
    const created = await service.create(
      doctor,
      reportId.toHexString(),
      CareReportExportFormat.CSV,
      'doctor-key',
    );
    await processor.process(created.id as string, false);
    const csv = [...objects.entries()]
      .find(([key]) => key.includes(created.id as string))?.[1]
      .toString('utf8');
    expect(csv).toContain('private-id');
    await expect(
      service.create(
        { id: doctorId.toHexString(), role: UserRole.ADMIN },
        reportId.toHexString(),
        CareReportExportFormat.CSV,
        'admin-key',
      ),
    ).rejects.toMatchObject({
      response: { code: 'CARE_REPORT_EXPORT_NOT_FOUND' },
    });
  });

  it('allows only one concurrent worker claim for the same immutable job', async () => {
    const actor = { id: patientId.toHexString(), role: UserRole.PATIENT };
    const created = await service.create(
      actor,
      reportId.toHexString(),
      CareReportExportFormat.CSV,
      'worker-race-key',
    );
    const results = await Promise.allSettled([
      processor.process(created.id as string, false),
      processor.process(created.id as string, false),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(
      1,
    );
    expect(
      await connection.db!.collection('carereportexports').findOne({
        _id: new ObjectId(created.id as string),
      }),
    ).toMatchObject({ status: 'ready', attemptCount: 1 });
  });

  it('records terminal failure and expires only the private artifact', async () => {
    const actor = { id: patientId.toHexString(), role: UserRole.PATIENT };
    const failed = await service.create(
      actor,
      reportId.toHexString(),
      CareReportExportFormat.CSV,
      'failed-key',
    );
    await connection
      .db!.collection('carereports')
      .updateOne({ _id: reportId }, { $set: { inputHash: 'b'.repeat(64) } });
    await expect(processor.process(failed.id as string, true)).rejects.toThrow(
      'CARE_REPORT_EXPORT_REPORT_SNAPSHOT_MISMATCH',
    );
    expect(
      await connection.db!.collection('carereportexports').findOne({
        _id: new ObjectId(failed.id as string),
      }),
    ).toMatchObject({
      status: 'failed',
      failureReasonCode: 'CARE_REPORT_EXPORT_REPORT_SNAPSHOT_MISMATCH',
    });
    await connection
      .db!.collection('carereports')
      .updateOne({ _id: reportId }, { $set: { inputHash: 'a'.repeat(64) } });
    const ready = await service.create(
      actor,
      reportId.toHexString(),
      CareReportExportFormat.CSV,
      'expiry-key',
    );
    await processor.process(ready.id as string, false);
    const readyRecord = await connection
      .db!.collection('carereportexports')
      .findOne({
        _id: new ObjectId(ready.id as string),
      });
    const storageKey = readyRecord!.storageKey as string;
    await connection
      .db!.collection('carereportexports')
      .updateOne(
        { _id: readyRecord!._id },
        { $set: { expiresAt: new Date(0) } },
      );
    await processor.cleanupExpired();
    expect(objects.has(storageKey)).toBe(false);
    expect(
      await connection.db!.collection('carereportexports').findOne({
        _id: readyRecord!._id,
      }),
    ).toMatchObject({ status: 'expired' });
    expect(
      await connection
        .db!.collection('carereports')
        .countDocuments({ _id: reportId }),
    ).toBe(1);
  });
});
