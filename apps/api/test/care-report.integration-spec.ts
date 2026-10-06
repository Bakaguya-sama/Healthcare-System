import { HttpStatus } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { Connection, createConnection } from 'mongoose';
import { UserRole } from '../src/core/domain/user.enums';
import { applyCc006CareReports } from '../src/database/migrations/202610061100-cc006-care-reports';
import type {
  HealthMetricPort,
  HealthMetricReportItem,
} from '../src/modules/health-tracking/public-api';
import { CareReportService } from '../src/modules/chronic-care/application/services/care-report.service';
import {
  CareAlert,
  CareAlertSchema,
} from '../src/modules/chronic-care/domain/entities/care-alert.entity';
import {
  CareReport,
  CareReportSchema,
  CareReportType,
} from '../src/modules/chronic-care/domain/entities/care-report.entity';
import {
  CareTask,
  CareTaskSchema,
} from '../src/modules/chronic-care/domain/entities/care-task.entity';
import {
  HealthEvaluation,
  HealthEvaluationSchema,
} from '../src/modules/chronic-care/domain/entities/health-evaluation.entity';
import {
  PatientCareProgram,
  PatientCareProgramSchema,
} from '../src/modules/chronic-care/domain/entities/patient-care-program.entity';

jest.setTimeout(30_000);

const baseMongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_cc006_test?replicaSet=rs0&directConnection=true';

describe('CC-006 deterministic CareReport', () => {
  let connection: Connection;
  let service: CareReportService;
  let metricItems: HealthMetricReportItem[];
  const enrollmentId = new ObjectId();
  const patientId = new ObjectId();
  const doctorId = new ObjectId();
  const otherDoctorId = new ObjectId();
  const cutoff = new Date('2026-10-06T05:00:00.000Z');

  beforeAll(async () => {
    const uri = new URL(baseMongoUri);
    uri.pathname = `/healthcare_cc006_${new ObjectId().toHexString()}`;
    connection = await createConnection(uri.toString(), {
      autoIndex: false,
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    await applyCc006CareReports(connection.db!);

    const enrollmentModel = connection.model(
      PatientCareProgram.name,
      PatientCareProgramSchema,
    );
    const taskModel = connection.model(CareTask.name, CareTaskSchema);
    const evaluationModel = connection.model(
      HealthEvaluation.name,
      HealthEvaluationSchema,
    );
    const alertModel = connection.model(CareAlert.name, CareAlertSchema);
    const reportModel = connection.model(CareReport.name, CareReportSchema);

    await enrollmentModel.create({
      _id: enrollmentId,
      revision: 1,
      patientId,
      doctorId,
      careProgramId: new ObjectId(),
      careRuleId: new ObjectId(),
      status: 'active',
      timezone: 'Asia/Saigon',
      consent: { policyVersion: 'v1' },
      programConfig: {},
      createdBy: doctorId,
    });
    await taskModel.create([
      {
        patientCareProgramId: enrollmentId,
        patientId,
        doctorId,
        templateKey: 'morning_bp',
        taskType: 'metric',
        status: 'completed',
        required: true,
        scheduleVersion: 'v1',
        scheduledFor: new Date('2026-10-01T01:00:00.000Z'),
        windowStart: new Date('2026-10-01T00:00:00.000Z'),
        windowEnd: new Date('2026-10-01T02:00:00.000Z'),
        completionRule: {},
        reminderPolicy: {},
        uniqueKey: 'cc006-task-1',
      },
      {
        patientCareProgramId: enrollmentId,
        patientId,
        doctorId,
        templateKey: 'morning_bp',
        taskType: 'metric',
        status: 'missed',
        required: true,
        scheduleVersion: 'v1',
        scheduledFor: new Date('2026-10-02T01:00:00.000Z'),
        windowStart: new Date('2026-10-02T00:00:00.000Z'),
        windowEnd: new Date('2026-10-02T02:00:00.000Z'),
        completionRule: {},
        reminderPolicy: {},
        uniqueKey: 'cc006-task-2',
      },
    ]);
    metricItems = [
      {
        id: new ObjectId().toHexString(),
        metricType: 'blood_pressure',
        unit: 'mmHg',
        recordedAt: new Date('2026-10-01T01:00:00.000Z'),
        ingestedAt: new Date('2026-10-01T01:01:00.000Z'),
        values: { systolic: 120, diastolic: 80 },
      },
      {
        id: new ObjectId().toHexString(),
        metricType: 'blood_pressure',
        unit: 'mmHg',
        recordedAt: new Date('2026-10-03T01:00:00.000Z'),
        ingestedAt: new Date('2026-10-03T01:01:00.000Z'),
        values: { systolic: 140, diastolic: 90 },
      },
    ];
    const metricPort: HealthMetricPort = {
      findFirstRecordedInWindow: () => Promise.resolve(null),
      listRecordedInWindow: (input) =>
        Promise.resolve({
          items: metricItems.filter(
            (item) =>
              item.recordedAt >= input.from &&
              item.recordedAt < input.to &&
              item.ingestedAt <= input.ingestedUntil,
          ),
          truncated: false,
        }),
    };
    const consultationId = new ObjectId().toHexString();
    const consultationPort = {
      listForCareReport: () =>
        Promise.resolve({
          items: [
            {
              id: consultationId,
              sessionStatus: 'completed',
              requestedAt: new Date('2026-10-03T02:00:00.000Z'),
              completedAt: new Date('2026-10-03T02:30:00.000Z'),
              followUpAt: new Date('2026-10-10T02:00:00.000Z'),
            },
          ],
          truncated: false,
        }),
    };
    service = new CareReportService(
      reportModel as never,
      enrollmentModel as never,
      taskModel as never,
      evaluationModel as never,
      alertModel as never,
      metricPort,
      consultationPort,
      connection,
    );
  });

  afterAll(async () => {
    if (connection) {
      await connection.dropDatabase();
      await connection.close();
    }
  });

  it('is idempotent for unchanged inputs and creates a new immutable correction version', async () => {
    const actor = { id: doctorId.toHexString(), role: UserRole.DOCTOR };
    const first = await service.generate(
      actor,
      enrollmentId.toHexString(),
      CareReportType.WEEKLY,
      cutoff,
    );
    const replay = await service.generate(
      actor,
      enrollmentId.toHexString(),
      CareReportType.WEEKLY,
      cutoff,
    );
    expect(String(replay._id)).toBe(String(first._id));
    expect(first.reportVersion).toBe(1);
    expect(first.summaryInput.facts.statistics.tasks).toEqual({
      expected: 2,
      completed: 1,
      missed: 1,
      adherence: 0.5,
    });
    expect(
      first.summaryInput.provenance.sourceReferences?.metricIds,
    ).toHaveLength(2);
    expect(first.summaryInput.facts.consultations).toMatchObject({
      total: 1,
      completed: 1,
      followUpScheduled: 1,
    });

    metricItems = metricItems.map((metric, index) =>
      index === 1
        ? {
            ...metric,
            ingestedAt: new Date('2026-10-04T01:00:00.000Z'),
            values: { systolic: 150, diastolic: 95 },
          }
        : metric,
    );
    const corrected = await service.generate(
      actor,
      enrollmentId.toHexString(),
      CareReportType.WEEKLY,
      cutoff,
    );
    expect(corrected.reportVersion).toBe(2);
    expect(corrected.replacesReportId).toEqual(first._id);
    expect(corrected.inputHash).not.toBe(first.inputHash);
    expect(
      await connection.db!.collection('carereports').countDocuments(),
    ).toBe(2);
    expect(
      await connection
        .db!.collection('carereports')
        .findOne({ _id: first._id }),
    ).toMatchObject({ status: 'superseded' });
  });

  it('returns export-safe Patient facts without internal source IDs and needs no AI provider', async () => {
    const reports = await service.list(
      { id: patientId.toHexString(), role: UserRole.PATIENT },
      enrollmentId.toHexString(),
    );
    expect(reports).toHaveLength(2);
    expect(reports[0].sourceData).toBeUndefined();
    expect(reports[0].summaryInput.provenance.sourceReferences).toBeUndefined();
    expect(reports[0].summaryInput.facts.statistics).toBeDefined();
  });

  it('returns one report when identical generation requests race', async () => {
    const actor = { id: doctorId.toHexString(), role: UserRole.DOCTOR };
    const [left, right] = await Promise.all([
      service.generate(
        actor,
        enrollmentId.toHexString(),
        CareReportType.THIRTY_DAY,
        cutoff,
      ),
      service.generate(
        actor,
        enrollmentId.toHexString(),
        CareReportType.THIRTY_DAY,
        cutoff,
      ),
    ]);
    expect(String(left._id)).toBe(String(right._id));
    expect(
      await connection.db!.collection('carereports').countDocuments({
        reportType: CareReportType.THIRTY_DAY,
      }),
    ).toBe(1);
  });

  it('rejects a Doctor who is not assigned to the enrollment', async () => {
    await expect(
      service.generate(
        { id: otherDoctorId.toHexString(), role: UserRole.DOCTOR },
        enrollmentId.toHexString(),
        CareReportType.WEEKLY,
        cutoff,
      ),
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
  });
});
