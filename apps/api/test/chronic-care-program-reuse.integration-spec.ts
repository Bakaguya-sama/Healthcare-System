import { ObjectId } from 'mongodb';
import { Connection, createConnection } from 'mongoose';
import { UserRole } from '../src/core/domain/user.enums';
import { seedChronicCareProgramCatalog } from '../src/database/seeds/chronic-care-foundation.seed';
import { CareReportService } from '../src/modules/chronic-care/application/services/care-report.service';
import { CareTaskSchedulerService } from '../src/modules/chronic-care/application/services/care-task-scheduler.service';
import { HealthEvaluationService } from '../src/modules/chronic-care/application/services/health-evaluation.service';
import { STANDARD_CARE_PROGRAMS } from '../src/modules/chronic-care/domain/catalog/standard-care-programs';
import { localDate } from '../src/modules/chronic-care/domain/tasks/care-task-timezone';
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
  'mongodb://127.0.0.1:27018/healthcare_cc011_test?replicaSet=rs0&directConnection=true';
const patientId = new ObjectId();
const doctorId = new ObjectId();

describe('CC-011 standard program reuse', () => {
  let connection: Connection;
  const hypertensionEnrollmentId = new ObjectId();
  const diabetesEnrollmentId = new ObjectId();
  const hypertensionRuleId = new ObjectId();
  const diabetesRuleId = new ObjectId();
  const today = localDate(new Date(), 'Asia/Saigon');
  const now = new Date(
    new Date(`${today}T00:30:00.000Z`).getTime() - 24 * 60 * 60 * 1_000,
  );

  beforeAll(async () => {
    const uri = new URL(baseMongoUri);
    uri.pathname = `/healthcare_cc011_${new ObjectId().toHexString()}`;
    connection = await createConnection(uri.toString(), {
      autoIndex: false,
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
  });

  afterAll(async () => {
    if (!connection) return;
    await connection.dropDatabase();
    await connection.close();
  });

  it('seeds hypertension and diabetes idempotently as data-only catalog entries', async () => {
    const createdBy = new ObjectId();
    const first = await seedChronicCareProgramCatalog(
      connection.db!,
      createdBy,
    );
    const second = await seedChronicCareProgramCatalog(
      connection.db!,
      createdBy,
    );

    expect(Object.keys(first).sort()).toEqual([
      'demo-diabetes',
      'demo-hypertension',
    ]);
    expect(second['demo-diabetes'].careProgramId).toEqual(
      first['demo-diabetes'].careProgramId,
    );
    expect(
      await connection.db!.collection('careprograms').countDocuments(),
    ).toBe(2);
    expect(await connection.db!.collection('carerules').countDocuments()).toBe(
      2,
    );
  });

  it('runs both program configurations through one task, evaluation and report flow', async () => {
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
    const hypertension = STANDARD_CARE_PROGRAMS[0];
    const diabetes = STANDARD_CARE_PROGRAMS[1];

    await enrollmentModel.create([
      enrollment(hypertensionEnrollmentId, hypertensionRuleId, hypertension),
      enrollment(diabetesEnrollmentId, diabetesRuleId, diabetes),
    ]);

    const metricByType = {
      blood_pressure: metric(now, 'blood_pressure', {
        systolic: 180,
        diastolic: 110,
      }),
      blood_glucose: metric(now, 'blood_glucose', { value: 250 }),
    } as const;
    const metricPort = {
      findFirstRecordedInWindow: async ({
        metricType,
      }: {
        metricType: string;
      }) => metricByType[metricType as keyof typeof metricByType] ?? null,
      listRecordedInWindow: async (input: {
        from: Date;
        to: Date;
        ingestedUntil: Date;
      }) => ({
        items: Object.values(metricByType).filter(
          (item) =>
            item.recordedAt >= input.from &&
            item.recordedAt < input.to &&
            item.ingestedAt <= input.ingestedUntil,
        ),
        truncated: false,
      }),
    };
    const evaluations = new HealthEvaluationService(
      enrollmentModel as never,
      evaluationModel as never,
      { createForEvaluation: async () => null } as never,
    );
    const scheduler = new CareTaskSchedulerService(
      taskModel as never,
      enrollmentModel as never,
      { enqueue: async () => undefined } as never,
      metricPort,
      evaluations,
    );

    await scheduler.scheduleActiveEnrollments(now, 1);
    await scheduler.advanceTaskStatuses(now);

    const tasks = await taskModel.find().sort({ templateKey: 1 }).lean();
    expect(tasks.map((task) => task.completionRule)).toEqual([
      { metricType: 'blood_glucose' },
      { metricType: 'blood_pressure' },
    ]);
    expect(tasks.every((task) => task.status === 'completed')).toBe(true);

    const evaluationsCreated = await evaluationModel
      .find()
      .sort({ careRuleId: 1 })
      .lean();
    expect(evaluationsCreated).toHaveLength(2);
    expect(
      evaluationsCreated.every(
        (evaluation) => evaluation.severity === 'urgent',
      ),
    ).toBe(true);
    expect(
      evaluationsCreated.map((evaluation) => evaluation.reasonCodes.sort()),
    ).toEqual(
      expect.arrayContaining([
        ['glucose_elevated', 'glucose_urgent'],
        ['systolic_elevated', 'systolic_urgent'],
      ]),
    );

    const reports = new CareReportService(
      reportModel as never,
      enrollmentModel as never,
      taskModel as never,
      evaluationModel as never,
      alertModel as never,
      metricPort,
      { listForCareReport: async () => ({ items: [], truncated: false }) },
      connection,
    );
    const actor = { id: doctorId.toHexString(), role: UserRole.DOCTOR };
    const reportCutoff = new Date();
    const hypertensionReport = await reports.generate(
      actor,
      hypertensionEnrollmentId.toHexString(),
      CareReportType.WEEKLY,
      reportCutoff,
    );
    const diabetesReport = await reports.generate(
      actor,
      diabetesEnrollmentId.toHexString(),
      CareReportType.WEEKLY,
      reportCutoff,
    );
    expect(
      (
        hypertensionReport.summaryInput.facts.statistics.tasks as Record<
          string,
          unknown
        >
      ).completed,
    ).toBe(1);
    expect(
      (
        diabetesReport.summaryInput.facts.statistics.tasks as Record<
          string,
          unknown
        >
      ).completed,
    ).toBe(1);
  });
});

function enrollment(
  id: ObjectId,
  careRuleId: ObjectId,
  program: (typeof STANDARD_CARE_PROGRAMS)[number],
) {
  return {
    _id: id,
    revision: 1,
    patientId,
    doctorId,
    careProgramId: new ObjectId(),
    careRuleId,
    status: 'active',
    timezone: 'Asia/Saigon',
    consent: { policyVersion: 'v1' },
    programConfig: {
      programCode: program.programCode,
      programVersion: 1,
      baselineForm: program.baselineForm,
      taskTemplates: program.taskTemplates,
      ruleSnapshot: {
        careRuleId: careRuleId.toHexString(),
        version: 1,
        revision: 1,
        rules: program.rules,
      },
    },
    createdBy: doctorId,
  };
}

function metric(now: Date, metricType: string, values: Record<string, number>) {
  return {
    id: new ObjectId().toHexString(),
    metricType,
    unit: metricType === 'blood_pressure' ? 'mmHg' : 'mg/dL',
    recordedAt: new Date(now.getTime() - 15 * 60_000),
    ingestedAt: new Date(now.getTime() - 10 * 60_000),
    values,
  };
}
