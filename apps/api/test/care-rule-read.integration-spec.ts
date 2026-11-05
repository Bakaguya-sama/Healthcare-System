import { randomUUID } from 'node:crypto';
import { Double, MongoClient, ObjectId } from 'mongodb';
import { Connection, createConnection, Model } from 'mongoose';
import { migrateDatabase } from '../src/database/migrations/run-migrations';
import { UserRole } from '../src/core/domain/user.enums';
import { CareRuleReadService } from '../src/modules/chronic-care/application/services/care-rule-read.service';
import {
  CareProgram,
  CareProgramSchema,
  CareProgramStatus,
} from '../src/modules/chronic-care/domain/entities/care-program.entity';
import {
  CareRule,
  CareRuleSchema,
  CareRuleStatus,
} from '../src/modules/chronic-care/domain/entities/care-rule.entity';
import { CareTaskType } from '../src/modules/chronic-care/domain/entities/care-task.entity';
import {
  AdminCareRuleProjectionDto,
  CareRuleReadView,
} from '../src/modules/chronic-care/presentation/dto/care-rule-read.dto';

jest.setTimeout(45_000);

const baseMongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_care_rule_read_test?replicaSet=rs0&directConnection=true';

describe('P0 CareRule read service', () => {
  let connection: Connection;
  let programs: Model<CareProgram>;
  let rules: Model<CareRule>;
  let service: CareRuleReadService;
  const adminId = new ObjectId();
  const doctorId = new ObjectId();
  const inactiveDoctorId = new ObjectId();
  const patientId = new ObjectId();

  beforeAll(async () => {
    const uri = new URL(baseMongoUri);
    uri.pathname = `/healthcare_care_rule_read_${randomUUID().replaceAll('-', '')}`;
    const mongo = new MongoClient(uri.toString());
    await mongo.connect();
    await migrateDatabase(mongo.db());
    await mongo.close();
    connection = await createConnection(uri.toString(), {
      autoIndex: false,
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    programs = connection.model(CareProgram.name, CareProgramSchema);
    rules = connection.model(CareRule.name, CareRuleSchema);
    service = new CareRuleReadService(programs as never, rules as never, {
      isActiveAndApproved: (id: string) =>
        Promise.resolve(id === doctorId.toHexString()),
    });
  });

  afterAll(async () => {
    if (!connection) return;
    await connection.dropDatabase();
    await connection.close();
  });

  beforeEach(async () => {
    await Promise.all([programs.deleteMany({}), rules.deleteMany({})]);
  });

  it('lets an approved Doctor read only the bounded active summary of a published Program', async () => {
    const program = await createProgram(CareProgramStatus.PUBLISHED);
    const rule = await createRule(program._id, CareRuleStatus.ACTIVE, 1, {
      status: 'passed',
      total: 2,
      passed: 2,
      failed: 0,
      interpreterVersion: 'care-rule-v1',
      scenarios: [scenario('approved-case')],
      rawFactMap: { patient_secret: true },
    });

    const result = await service.getCurrentRule(
      actor(UserRole.DOCTOR, doctorId),
      String(program._id),
      CareRuleReadView.ACTIVE,
    );

    expect(result).toEqual({
      id: String(rule._id),
      careProgramId: String(program._id),
      version: 1,
      status: CareRuleStatus.ACTIVE,
      testSummary: {
        status: 'passed',
        total: 2,
        passed: 2,
        failed: 0,
        interpreterVersion: 'care-rule-v1',
      },
    });
    expect(result).not.toHaveProperty('rules');
    expect(result).not.toHaveProperty('dataSources');
    expect(result).not.toHaveProperty('testResults');
    expect(JSON.stringify(result)).not.toContain('patient_secret');
  });

  it('denies Patient, inactive Doctor and Doctor draft reads without requiring an Enrollment', async () => {
    const program = await createProgram(CareProgramStatus.PUBLISHED);
    await createRule(program._id, CareRuleStatus.ACTIVE, 1);

    await expect(
      service.getCurrentRule(
        actor(UserRole.PATIENT, patientId),
        String(program._id),
        CareRuleReadView.ACTIVE,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.getCurrentRule(
        actor(UserRole.DOCTOR, inactiveDoctorId),
        String(program._id),
        CareRuleReadView.ACTIVE,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.getCurrentRule(
        actor(UserRole.DOCTOR, doctorId),
        String(program._id),
        CareRuleReadView.DRAFT,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('enforces the Program status matrix for Doctor and Admin', async () => {
    const draftProgram = await createProgram(CareProgramStatus.DRAFT);
    const publishedProgram = await createProgram(CareProgramStatus.PUBLISHED);
    const retiredProgram = await createProgram(CareProgramStatus.RETIRED);
    await createRule(draftProgram._id, CareRuleStatus.DRAFT, 1);
    await createRule(publishedProgram._id, CareRuleStatus.ACTIVE, 1);
    await createRule(publishedProgram._id, CareRuleStatus.DRAFT, 2);
    await createRule(retiredProgram._id, CareRuleStatus.ACTIVE, 1);

    await expect(readAsDoctor(draftProgram._id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(readAsDoctor(retiredProgram._id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      readAsAdmin(draftProgram._id, CareRuleReadView.ACTIVE),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      readAsAdmin(retiredProgram._id, CareRuleReadView.DRAFT),
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      readAsAdmin(draftProgram._id, CareRuleReadView.DRAFT),
    ).resolves.toMatchObject({ status: CareRuleStatus.DRAFT });
    await expect(
      readAsAdmin(publishedProgram._id, CareRuleReadView.ACTIVE),
    ).resolves.toMatchObject({ status: CareRuleStatus.ACTIVE });
    await expect(
      readAsAdmin(publishedProgram._id, CareRuleReadView.DRAFT),
    ).resolves.toMatchObject({ status: CareRuleStatus.DRAFT });
    await expect(
      readAsAdmin(retiredProgram._id, CareRuleReadView.ACTIVE),
    ).resolves.toMatchObject({ status: CareRuleStatus.ACTIVE });
  });

  it('selects the latest draft deterministically by version and returns validated declarative data', async () => {
    const program = await createProgram(CareProgramStatus.PUBLISHED);
    await createRule(program._id, CareRuleStatus.DRAFT, 1);
    const latest = await createRule(program._id, CareRuleStatus.DRAFT, 3);
    await createRule(program._id, CareRuleStatus.DRAFT, 2);

    const result = await readAsAdmin(program._id, CareRuleReadView.DRAFT);

    expect(result).toMatchObject({
      id: String(latest._id),
      version: 3,
      revision: 1,
      status: CareRuleStatus.DRAFT,
      rules: [
        {
          operator: 'equal',
          key: 'check_in.severity',
          value: 'severe',
          reasonCode: 'severe_symptoms',
          severity: 'urgent',
        },
      ],
      dataSources: [
        {
          kind: 'care_task_check_in',
          schemaVersion: 'health-check-in.v1',
          templateKey: 'daily_check_in',
          allowedFactPrefixes: ['check_in.severity'],
        },
      ],
    });
  });

  it('bounds and allowlists Admin scenario evidence without leaking raw Mixed fields', async () => {
    const program = await createProgram(CareProgramStatus.PUBLISHED);
    await createRule(program._id, CareRuleStatus.ACTIVE, 1, {
      summary: {
        status: 'failed',
        total: 60,
        passed: 40,
        failed: 20,
        reasonCodes: ['fixture_failure'],
        executedAt: '2026-11-05T00:00:00.000Z',
        stack: 'SUMMARY_SECRET',
      },
      scenarios: Array.from({ length: 60 }, (_, index) => ({
        ...scenario(`scenario-${index}`),
        patientId: `PATIENT_SECRET_${index}`,
        facts: { check_in: 'RAW_CHECK_IN_SECRET' },
        trace: ['TRACE_SECRET'],
      })),
      evaluationContext: { enrollmentId: 'ENROLLMENT_SECRET' },
    });

    const result = await readAsAdmin(program._id, CareRuleReadView.ACTIVE);
    expect(result.testResults).toHaveLength(50);
    expect(result.testResults?.[0]).toEqual(scenario('scenario-0'));
    expect(result.testSummary).toMatchObject({
      status: 'failed',
      total: 60,
      passed: 40,
      failed: 20,
    });
    const json = JSON.stringify(result);
    expect(json).not.toContain('PATIENT_SECRET');
    expect(json).not.toContain('RAW_CHECK_IN_SECRET');
    expect(json).not.toContain('TRACE_SECRET');
    expect(json).not.toContain('ENROLLMENT_SECRET');
    expect(json).not.toContain('SUMMARY_SECRET');
  });

  it('omits missing evidence and fails closed for malformed evidence or declarative configuration', async () => {
    const missingEvidenceProgram = await createProgram(
      CareProgramStatus.PUBLISHED,
    );
    await createRule(
      missingEvidenceProgram._id,
      CareRuleStatus.ACTIVE,
      1,
      undefined,
    );
    const noEvidence = await readAsAdmin(
      missingEvidenceProgram._id,
      CareRuleReadView.ACTIVE,
    );
    expect(noEvidence).not.toHaveProperty('testSummary');
    expect(noEvidence).not.toHaveProperty('testResults');

    const malformedEvidenceProgram = await createProgram(
      CareProgramStatus.PUBLISHED,
    );
    await createRule(malformedEvidenceProgram._id, CareRuleStatus.ACTIVE, 1, {
      status: 'passed',
      total: -1,
    });
    await expect(
      readAsAdmin(malformedEvidenceProgram._id, CareRuleReadView.ACTIVE),
    ).rejects.toMatchObject({
      status: 503,
      response: { code: 'CARE_RULE_PROJECTION_UNAVAILABLE' },
    });

    const malformedRuleProgram = await createProgram(
      CareProgramStatus.PUBLISHED,
    );
    const malformedRule = await createRule(
      malformedRuleProgram._id,
      CareRuleStatus.ACTIVE,
      1,
    );
    await connection
      .db!.collection('carerules')
      .updateOne(
        { _id: malformedRule._id },
        { $set: { 'rules.0.script': 'return patient.secret' } },
      );
    await expect(
      readAsAdmin(malformedRuleProgram._id, CareRuleReadView.ACTIVE),
    ).rejects.toMatchObject({
      status: 503,
      response: { code: 'CARE_RULE_PROJECTION_UNAVAILABLE' },
    });

    const malformedSourceProgram = await createProgram(
      CareProgramStatus.PUBLISHED,
    );
    const malformedSourceRule = await createRule(
      malformedSourceProgram._id,
      CareRuleStatus.ACTIVE,
      1,
    );
    await connection
      .db!.collection('carerules')
      .updateOne(
        { _id: malformedSourceRule._id },
        { $set: { 'dataSources.0.mongoQuery': { $where: 'patient.secret' } } },
      );
    await expect(
      readAsAdmin(malformedSourceProgram._id, CareRuleReadView.ACTIVE),
    ).rejects.toMatchObject({
      status: 503,
      response: { code: 'CARE_RULE_PROJECTION_UNAVAILABLE' },
    });
  });

  it('uses safe not-found errors for invalid IDs, missing Programs and missing Rules', async () => {
    await expect(
      service.getCurrentRule(
        actor(UserRole.ADMIN, adminId),
        'not-an-object-id',
        CareRuleReadView.ACTIVE,
      ),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'CARE_RULE_NOT_FOUND' },
    });
    await expect(
      readAsAdmin(new ObjectId(), CareRuleReadView.ACTIVE),
    ).rejects.toMatchObject({ status: 404 });
    const program = await createProgram(CareProgramStatus.PUBLISHED);
    await expect(
      readAsAdmin(program._id, CareRuleReadView.ACTIVE),
    ).rejects.toMatchObject({ status: 404 });
  });

  async function createProgram(status: CareProgramStatus) {
    const document = {
      _id: new ObjectId(),
      programCode: `PROGRAM_${randomUUID()}`,
      version: new Double(1),
      revision: 1,
      name: 'Care Rule read fixture',
      diseaseKey: 'hypertension',
      status,
      baselineForm: { schemaVersion: 'v1', fields: [] },
      taskTemplates: [
        {
          key: 'daily_check_in',
          type: CareTaskType.CHECK_IN,
          required: true,
          schedule: {
            frequency: 'daily',
            time: '08:00',
            windowMinutes: 120,
          },
          completionRule: {
            responseMode: 'health_check_in',
            schemaVersion: 'health-check-in.v1',
            allowedSymptomCodes: ['headache'],
          },
        },
      ],
      reminderPolicy: {},
      doctorEditableFields: [],
      contentJourney: [],
      dataSources: [],
      createdBy: adminId,
      ...(status === CareProgramStatus.PUBLISHED
        ? { publishedBy: adminId, publishedAt: new Date() }
        : {}),
      ...(status === CareProgramStatus.RETIRED
        ? { retiredBy: adminId, retiredAt: new Date() }
        : {}),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await connection.db!.collection('careprograms').insertOne(document);
    return document;
  }

  async function createRule(
    careProgramId: ObjectId,
    status: CareRuleStatus,
    version: number,
    testResults?: Record<string, unknown>,
  ) {
    const document = {
      _id: new ObjectId(),
      careProgramId,
      version: new Double(version),
      revision: 1,
      status,
      rules: [
        {
          operator: 'equal',
          key: 'check_in.severity',
          value: 'severe',
          reasonCode: 'severe_symptoms',
          severity: 'urgent',
        },
      ],
      dataSources: [
        {
          kind: 'care_task_check_in',
          schemaVersion: 'health-check-in.v1',
          templateKey: 'daily_check_in',
          allowedFactPrefixes: ['check_in.severity'],
        },
      ],
      ...(testResults === undefined ? {} : { testResults }),
      createdBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await connection.db!.collection('carerules').insertOne(document);
    return document;
  }

  function readAsDoctor(programId: ObjectId) {
    return service.getCurrentRule(
      actor(UserRole.DOCTOR, doctorId),
      String(programId),
      CareRuleReadView.ACTIVE,
    );
  }

  function readAsAdmin(programId: ObjectId, view: CareRuleReadView) {
    return service.getCurrentRule(
      actor(UserRole.ADMIN, adminId),
      String(programId),
      view,
    ) as Promise<AdminCareRuleProjectionDto>;
  }
});

function actor(role: UserRole, id: ObjectId) {
  return { id: id.toHexString(), role };
}

function scenario(scenarioKey: string) {
  return {
    scenarioKey,
    passed: true,
    expectedSeverity: 'urgent' as const,
    actualSeverity: 'urgent' as const,
    reasonCodes: ['severe_symptoms'],
  };
}
