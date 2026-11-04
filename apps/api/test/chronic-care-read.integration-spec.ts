import { randomUUID } from 'node:crypto';
import { Double, MongoClient, ObjectId } from 'mongodb';
import { Connection, createConnection, Model } from 'mongoose';
import { migrateDatabase } from '../src/database/migrations/run-migrations';
import { UserRole } from '../src/core/domain/user.enums';
import { ChronicCareReadService } from '../src/modules/chronic-care/application/services/chronic-care-read.service';
import {
  CareProgram,
  CareProgramSchema,
  CareProgramStatus,
} from '../src/modules/chronic-care/domain/entities/care-program.entity';
import {
  PatientCareProgram,
  PatientCareProgramSchema,
  PatientCareProgramStatus,
} from '../src/modules/chronic-care/domain/entities/patient-care-program.entity';
import {
  CareTask,
  CareTaskSchema,
  CareTaskStatus,
  CareTaskType,
} from '../src/modules/chronic-care/domain/entities/care-task.entity';
import {
  CareAlert,
  CareAlertSchema,
  CareAlertStatus,
} from '../src/modules/chronic-care/domain/entities/care-alert.entity';
import {
  CareReport,
  CareReportSchema,
  CareReportStatus,
  CareReportType,
} from '../src/modules/chronic-care/domain/entities/care-report.entity';
import { HealthEvaluationSeverity } from '../src/modules/chronic-care/domain/entities/health-evaluation.entity';

jest.setTimeout(45_000);

const baseMongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_cc_read_test?replicaSet=rs0&directConnection=true';

describe('P0 Chronic Care read API service', () => {
  let connection: Connection;
  let service: ChronicCareReadService;
  let programs: Model<CareProgram>;
  let enrollments: Model<PatientCareProgram>;
  let tasks: Model<CareTask>;
  let alerts: Model<CareAlert>;
  let reports: Model<CareReport>;
  const patientId = new ObjectId();
  const otherPatientId = new ObjectId();
  const doctorId = new ObjectId();
  const otherDoctorId = new ObjectId();
  const adminId = new ObjectId();

  beforeAll(async () => {
    const uri = new URL(baseMongoUri);
    uri.pathname = `/healthcare_cc_read_${randomUUID().replaceAll('-', '')}`;
    const mongo = new MongoClient(uri.toString());
    await mongo.connect();
    await migrateDatabase(mongo.db());
    await mongo.close();
    connection = await createConnection(uri.toString(), {
      autoIndex: false,
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    programs = connection.model(CareProgram.name, CareProgramSchema);
    enrollments = connection.model(
      PatientCareProgram.name,
      PatientCareProgramSchema,
    );
    tasks = connection.model(CareTask.name, CareTaskSchema);
    alerts = connection.model(CareAlert.name, CareAlertSchema);
    reports = connection.model(CareReport.name, CareReportSchema);
    const activePatients = new Set([
      patientId.toHexString(),
      otherPatientId.toHexString(),
    ]);
    const approvedDoctors = new Set([
      doctorId.toHexString(),
      otherDoctorId.toHexString(),
    ]);
    const identities = new Map([
      [
        patientId.toHexString(),
        {
          id: patientId.toHexString(),
          fullName: 'Patient One',
          role: UserRole.PATIENT,
        },
      ],
      [
        otherPatientId.toHexString(),
        {
          id: otherPatientId.toHexString(),
          fullName: 'Patient Two',
          role: UserRole.PATIENT,
        },
      ],
      [
        doctorId.toHexString(),
        {
          id: doctorId.toHexString(),
          fullName: 'Doctor One',
          role: UserRole.DOCTOR,
          specialty: 'Cardiology',
        },
      ],
      [
        otherDoctorId.toHexString(),
        {
          id: otherDoctorId.toHexString(),
          fullName: 'Doctor Two',
          role: UserRole.DOCTOR,
        },
      ],
    ]);
    service = new ChronicCareReadService(
      programs as never,
      enrollments as never,
      tasks as never,
      alerts as never,
      reports as never,
      { isActive: (id: string) => Promise.resolve(activePatients.has(id)) },
      {
        isActiveAndApproved: (id: string) =>
          Promise.resolve(approvedDoctors.has(id)),
      },
      {
        findSafeSummaries: (ids: readonly string[]) =>
          Promise.resolve(
            ids.map((id) => identities.get(id)).filter(Boolean) as never,
          ),
      },
    );
  });

  afterAll(async () => {
    if (!connection) return;
    await connection.dropDatabase();
    await connection.close();
  });

  beforeEach(async () => {
    await Promise.all([
      programs.deleteMany({}),
      enrollments.deleteMany({}),
      tasks.deleteMany({}),
      alerts.deleteMany({}),
      reports.deleteMany({}),
    ]);
  });

  it('limits patient/doctor catalog reads to published Programs and uses role projections', async () => {
    const published = await createProgram(
      'HTN',
      CareProgramStatus.PUBLISHED,
      'Hypertension',
    );
    const draft = await createProgram(
      'DIA',
      CareProgramStatus.DRAFT,
      'Diabetes',
    );
    await createProgram('COPD', CareProgramStatus.RETIRED, 'COPD');

    const patientList = await service.listPrograms(
      actor(UserRole.PATIENT, patientId),
      programQuery(),
    );
    expect(patientList.items).toHaveLength(1);
    expect(patientList.items[0]).toMatchObject({
      id: String(published._id),
      status: 'published',
    });
    const patientDraftFilter = await service.listPrograms(
      actor(UserRole.PATIENT, patientId),
      programQuery({ status: CareProgramStatus.DRAFT }),
    );
    expect(patientDraftFilter.items).toEqual([]);
    const patientDetail = await service.getProgram(
      actor(UserRole.PATIENT, patientId),
      String(published._id),
    );
    expect(patientDetail).toHaveProperty('eligibilityForm');
    expect(patientDetail).not.toHaveProperty('baselineForm');
    expect(patientDetail).not.toHaveProperty('createdBy');
    await expect(
      service.getProgram(actor(UserRole.PATIENT, patientId), String(draft._id)),
    ).rejects.toMatchObject({ status: 404 });

    const doctorDetail = await service.getProgram(
      actor(UserRole.DOCTOR, doctorId),
      String(published._id),
    );
    expect(doctorDetail).toHaveProperty('baselineForm');
    expect(doctorDetail).not.toHaveProperty('createdBy');
    const adminList = await service.listPrograms(
      actor(UserRole.ADMIN, adminId),
      programQuery({ status: CareProgramStatus.DRAFT }),
    );
    expect(adminList.items).toHaveLength(1);
    const adminDetail = await service.getProgram(
      actor(UserRole.ADMIN, adminId),
      String(draft._id),
    );
    expect(adminDetail).toHaveProperty('revision');
  });

  it('applies allowlisted filters, bounded pages and a stable _id tie-breaker', async () => {
    const first = await createProgram(
      'A',
      CareProgramStatus.PUBLISHED,
      'Same',
      new Date('2026-01-01T00:00:00Z'),
    );
    const second = await createProgram(
      'B',
      CareProgramStatus.PUBLISHED,
      'Same',
      new Date('2026-01-01T00:00:00Z'),
    );
    const page = await service.listPrograms(
      actor(UserRole.PATIENT, patientId),
      programQuery({ limit: 1, sortBy: 'name', sortOrder: 1 }),
    );
    expect(page).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(page.items[0].id).toBe(
      [String(first._id), String(second._id)].sort()[0],
    );
    const filtered = await service.listPrograms(
      actor(UserRole.PATIENT, patientId),
      programQuery({ diseaseKey: 'disease-B' }),
    );
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0]).toMatchObject({ programCode: 'B' });
  });

  it('enforces patient ownership, assigned-doctor scope, conjunctive patient filter and denies Admin', async () => {
    const program = await createProgram(
      'HTN',
      CareProgramStatus.PUBLISHED,
      'Hypertension',
    );
    const own = await createEnrollment(program._id, patientId, doctorId);
    await createEnrollment(program._id, otherPatientId, otherDoctorId);

    const patientPage = await service.listEnrollments(
      actor(UserRole.PATIENT, patientId),
      enrollmentQuery(),
    );
    expect(patientPage.items).toHaveLength(1);
    expect(patientPage.items[0]).toMatchObject({
      id: String(own._id),
      assignedDoctor: { id: doctorId.toHexString() },
    });
    await expect(
      service.listEnrollments(
        actor(UserRole.PATIENT, patientId),
        enrollmentQuery({ patientId: otherPatientId.toHexString() }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    const doctorPage = await service.listEnrollments(
      actor(UserRole.DOCTOR, doctorId),
      enrollmentQuery({
        patientId: patientId.toHexString(),
        programCode: 'HTN',
      }),
    );
    expect(doctorPage.items[0]).toMatchObject({
      id: String(own._id),
      patient: { id: patientId.toHexString() },
    });
    await expect(
      service.getEnrollment(
        actor(UserRole.DOCTOR, otherDoctorId),
        String(own._id),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.getEnrollment(
        actor(UserRole.PATIENT, otherPatientId),
        String(own._id),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.listEnrollments(
        actor(UserRole.ADMIN, adminId),
        enrollmentQuery(),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('returns bounded detail summaries without raw task, alert, report or rule inputs', async () => {
    const program = await createProgram(
      'HTN',
      CareProgramStatus.PUBLISHED,
      'Hypertension',
    );
    const enrollment = await createEnrollment(program._id, patientId, doctorId);
    const now = new Date('2026-11-04T03:00:00.000Z');
    await tasks.create({
      patientCareProgramId: enrollment._id,
      patientId,
      doctorId,
      templateKey: 'bp',
      taskType: CareTaskType.METRIC,
      status: CareTaskStatus.COMPLETED,
      required: true,
      scheduleVersion: 'v1',
      scheduledFor: now,
      windowStart: now,
      windowEnd: new Date(now.getTime() + 60_000),
      completionRule: { metricType: 'blood_pressure' },
      reminderPolicy: { enabled: false },
      response: { secretAnswer: 'TASK_SECRET' },
      completedAt: now,
      uniqueKey: 'detail-task',
    });
    await alerts.create({
      revision: 1,
      patientCareProgramId: enrollment._id,
      evaluationId: new ObjectId(),
      patientId,
      assignedDoctorId: doctorId,
      severity: HealthEvaluationSeverity.URGENT,
      status: CareAlertStatus.OPEN,
      reasonCodes: ['RAW_METRIC_SECRET'],
      uniqueKey: 'detail-alert',
      detectedAt: now,
    });
    await reports.create({
      patientCareProgramId: enrollment._id,
      patientId,
      careRuleId: new ObjectId(),
      reportType: CareReportType.WEEKLY,
      dataFormatVersion: 'v1',
      windowStart: now,
      windowEnd: now,
      timezone: 'Asia/Saigon',
      dataUntil: now,
      status: CareReportStatus.READY,
      statistics: { secret: 'REPORT_SECRET' },
      trends: { direction: 'stable' },
      missingData: [],
      healthEvaluationSummary: { urgent: 1 },
      sourceData: { raw: 'SOURCE_SECRET' },
      inputHash: 'hash',
      reportVersion: 1,
      generatedAt: now,
    });

    const detail = await service.getEnrollment(
      actor(UserRole.PATIENT, patientId),
      String(enrollment._id),
    );
    expect(detail).toMatchObject({
      id: String(enrollment._id),
      taskSummary: { counts: { completed: 1 } },
      alertSummary: { openCount: 1 },
      latestReport: { reportType: 'weekly' },
    });
    const json = JSON.stringify(detail);
    expect(json).not.toContain('TASK_SECRET');
    expect(json).not.toContain('RAW_METRIC_SECRET');
    expect(json).not.toContain('REPORT_SECRET');
    expect(json).not.toContain('SOURCE_SECRET');
    expect(json).not.toContain('RULE_SECRET');
  });

  async function createProgram(
    code: string,
    status: CareProgramStatus,
    name: string,
    publishedAt = new Date('2026-01-01T00:00:00Z'),
  ) {
    const document = {
      _id: new ObjectId(),
      programCode: code,
      version: new Double(1),
      revision: 1,
      name,
      diseaseKey: `disease-${code}`,
      description: `${name} public`,
      status,
      eligibilityForm: { public: true },
      baselineForm: {
        schemaVersion: 'v1',
        fields: [
          {
            key: 'blood_pressure',
            type: 'number',
            required: true,
            visibility: 'care_team',
          },
        ],
      },
      taskTemplates: [{ key: 'task' }],
      reminderPolicy: {},
      doctorEditableFields: [],
      contentJourney: [{ title: 'Public lesson' }],
      dataSources: [{ source: 'clinical' }],
      createdBy: adminId,
      ...(status === CareProgramStatus.PUBLISHED
        ? { publishedBy: adminId, publishedAt }
        : {}),
      ...(status === CareProgramStatus.RETIRED
        ? { retiredBy: adminId, retiredAt: publishedAt }
        : {}),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await connection.db!.collection('careprograms').insertOne(document);
    return document;
  }

  async function createEnrollment(
    careProgramId: ObjectId,
    enrolledPatientId: ObjectId,
    assignedDoctorId: ObjectId,
  ) {
    return enrollments.create({
      revision: 1,
      patientId: enrolledPatientId,
      doctorId: assignedDoctorId,
      careProgramId,
      careRuleId: new ObjectId(),
      status: PatientCareProgramStatus.ACTIVE,
      timezone: 'Asia/Saigon',
      consent: {
        policyVersion: 'v1',
        purposes: ['care'],
        acceptedAt: new Date(),
        internalProof: 'CONSENT_SECRET',
      },
      baselineAnswers: { systolic: 120 },
      baselineCompletedAt: new Date(),
      programConfig: { ruleSnapshot: { source: 'RULE_SECRET' } },
      startedAt: new Date(),
      expectedEndAt: new Date('2027-01-01T00:00:00Z'),
      createdBy: assignedDoctorId,
    });
  }
});

function actor(role: UserRole, id: ObjectId) {
  return { id: id.toHexString(), role };
}

function programQuery(overrides: Record<string, unknown> = {}) {
  return {
    page: 1,
    limit: 20,
    sortBy: 'publishedAt' as const,
    sortOrder: -1 as const,
    ...overrides,
  } as never;
}
function enrollmentQuery(overrides: Record<string, unknown> = {}) {
  return {
    page: 1,
    limit: 20,
    sortBy: 'updatedAt' as const,
    sortOrder: -1 as const,
    ...overrides,
  } as never;
}
