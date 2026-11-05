import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { Connection, createConnection, Model } from 'mongoose';
import { migrateDatabase } from '../src/database/migrations/run-migrations';
import { UserRole } from '../src/core/domain/user.enums';
import { AuditLog } from '../src/modules/platform-audit/public-api';
import { AuditLogSchema } from '../src/modules/platform-audit/domain/entities/audit-log.entity';
import { CareTaskProgressService } from '../src/modules/chronic-care/application/services/care-task-progress.service';
import { CareTaskPolicyEventService } from '../src/modules/chronic-care/application/services/care-task-policy-event.service';
import {
  CareCommandIdempotency,
  CareCommandIdempotencySchema,
} from '../src/modules/chronic-care/domain/entities/care-command-idempotency.entity';
import {
  CareTask,
  CareTaskSchema,
  CareTaskStatus,
  CareTaskType,
} from '../src/modules/chronic-care/domain/entities/care-task.entity';
import {
  PatientCareProgram,
  PatientCareProgramSchema,
  PatientCareProgramStatus,
} from '../src/modules/chronic-care/domain/entities/patient-care-program.entity';
import {
  CareTaskResponseAction,
  DoctorReviewReasonCode,
  HealthCheckInOverallStatus,
  HealthCheckInSeverity,
} from '../src/modules/chronic-care/presentation/dto/care-task.dto';

jest.setTimeout(45_000);

const baseMongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_care_task_read_test?replicaSet=rs0&directConnection=true';

describe('P0 Care Task read and non-metric response service', () => {
  let connection: Connection;
  let service: CareTaskProgressService;
  let tasks: Model<CareTask>;
  let enrollments: Model<PatientCareProgram>;
  let idempotency: Model<CareCommandIdempotency>;
  let audits: Model<AuditLog>;
  const enqueue = jest.fn().mockResolvedValue(undefined);
  const linkCareTask = jest.fn().mockResolvedValue(undefined);
  const evaluateCheckIn = jest.fn().mockResolvedValue(null);
  let eventService: CareTaskPolicyEventService;
  const patientId = new ObjectId();
  const otherPatientId = new ObjectId();
  const doctorId = new ObjectId();
  const otherDoctorId = new ObjectId();
  const adminId = new ObjectId();

  beforeAll(async () => {
    const uri = new URL(baseMongoUri);
    uri.pathname = `/healthcare_care_task_${randomUUID().replaceAll('-', '')}`;
    const mongo = new MongoClient(uri.toString());
    await mongo.connect();
    await migrateDatabase(mongo.db());
    await mongo.close();
    connection = await createConnection(uri.toString(), {
      autoIndex: false,
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    tasks = connection.model(CareTask.name, CareTaskSchema);
    enrollments = connection.model(
      PatientCareProgram.name,
      PatientCareProgramSchema,
    );
    idempotency = connection.model(
      CareCommandIdempotency.name,
      CareCommandIdempotencySchema,
    );
    audits = connection.model(AuditLog.name, AuditLogSchema);
    const activePatients = new Set([
      patientId.toHexString(),
      otherPatientId.toHexString(),
    ]);
    const activeDoctors = new Set([
      doctorId.toHexString(),
      otherDoctorId.toHexString(),
    ]);
    service = new CareTaskProgressService(
      tasks as never,
      enrollments as never,
      idempotency as never,
      audits as never,
      connection,
      { isActive: (id: string) => Promise.resolve(activePatients.has(id)) },
      {
        isActiveAndApproved: (id: string) =>
          Promise.resolve(activeDoctors.has(id)),
      },
      { enqueue } as never,
      {
        resolvePublished: async (reference: Record<string, unknown>) =>
          reference.contentId === 'approved_education'
            ? { ...reference, title: 'Approved education content' }
            : null,
      } as never,
      { linkCareTask } as never,
    );
    eventService = new CareTaskPolicyEventService(
      tasks as never,
      audits as never,
      connection,
      { evaluateCheckIn } as never,
    );
  });

  afterAll(async () => {
    if (!connection) return;
    await connection.dropDatabase();
    await connection.close();
  });

  beforeEach(async () => {
    await Promise.all([
      tasks.deleteMany({}),
      enrollments.deleteMany({}),
      idempotency.deleteMany({}),
      audits.deleteMany({}),
    ]);
    enqueue.mockClear();
    linkCareTask.mockClear();
    evaluateCheckIn.mockClear();
  });

  it('lists owned tasks with filters, pagination, stable ordering and no raw fields', async () => {
    const enrollment = await createEnrollment(patientId, doctorId);
    const when = new Date('2026-11-04T08:00:00.000Z');
    const first = await createTask(enrollment._id, {
      scheduledFor: when,
      response: { privateAnswer: 'must-not-leak' },
    });
    const second = await createTask(enrollment._id, { scheduledFor: when });
    await createTask(enrollment._id, {
      taskType: CareTaskType.METRIC,
      completionRule: { metricType: 'blood_pressure' },
    });

    const page = await service.list(
      actor(UserRole.PATIENT, patientId),
      String(enrollment._id),
      query({ type: CareTaskType.EDUCATION, limit: 1, sortOrder: 1 }),
    );
    expect(page).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(page.items[0].id).toBe(
      [String(first._id), String(second._id)].sort()[0],
    );
    expect(page.items[0]).not.toHaveProperty('response');
    expect(page.items[0]).not.toHaveProperty('completionRule');
    expect(page.items[0]).not.toHaveProperty('reminderPolicy');
  });

  it('enforces patient ownership, assigned-doctor scope and denies Admin', async () => {
    const enrollment = await createEnrollment(patientId, doctorId);
    const task = await createTask(enrollment._id);

    await expect(
      service.detail(actor(UserRole.PATIENT, otherPatientId), String(task._id)),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.detail(actor(UserRole.DOCTOR, otherDoctorId), String(task._id)),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.detail(actor(UserRole.ADMIN, adminId), String(task._id)),
    ).rejects.toMatchObject({ status: 404 });

    const doctorDetail = await service.detail(
      actor(UserRole.DOCTOR, doctorId),
      String(task._id),
    );
    expect(doctorDetail).toMatchObject({ id: String(task._id) });
    expect(doctorDetail.allowedActions).toEqual([]);
    expect(doctorDetail).not.toHaveProperty('response');
  });

  it('returns type-specific bounded detail and keeps metric completion on HLTH-02', async () => {
    const enrollment = await createEnrollment(patientId, doctorId);
    const metric = await createTask(enrollment._id, {
      taskType: CareTaskType.METRIC,
      completionRule: { metricType: 'blood_pressure' },
    });
    const detail = await service.detail(
      actor(UserRole.PATIENT, patientId),
      String(metric._id),
    );
    expect(detail).toMatchObject({
      presentation: {
        kind: 'metric',
        metricType: 'blood_pressure',
        responseEndpoint: 'HLTH-02',
      },
    });
    await expect(
      service.respond(
        actor(UserRole.PATIENT, patientId),
        String(metric._id),
        { action: CareTaskResponseAction.ACKNOWLEDGE },
        'metric-key',
        new Date(),
      ),
    ).rejects.toMatchObject({
      response: { code: 'CARE_TASK_RESPONSE_USE_HEALTH_METRIC' },
    });
    expect((await tasks.findById(metric._id).lean())?.status).not.toBe(
      CareTaskStatus.COMPLETED,
    );

    for (const taskType of [CareTaskType.CHECK_IN, CareTaskType.APPOINTMENT]) {
      const unsupported = await createTask(enrollment._id, {
        taskType,
        completionRule: { mode: 'not-configured' },
      });
      await expect(
        service.detail(
          actor(UserRole.PATIENT, patientId),
          String(unsupported._id),
        ),
      ).resolves.toMatchObject({
        presentation: {
          kind: taskType,
          responseConfigured: false,
          reasonCode: 'CARE_TASK_RESPONSE_POLICY_NOT_CONFIGURED',
        },
        allowedActions: [],
      });
    }

    const doctorReview = await createTask(enrollment._id, {
      taskType: CareTaskType.DOCTOR_REVIEW,
      completionRule: { responseMode: 'doctor_review' },
      contentRef: undefined,
    });
    await expect(
      service.detail(
        actor(UserRole.PATIENT, patientId),
        String(doctorReview._id),
      ),
    ).resolves.toMatchObject({
      presentation: { kind: CareTaskType.DOCTOR_REVIEW },
      allowedActions: [],
    });

    const consultationId = new ObjectId();
    const appointment = await createTask(enrollment._id, {
      taskType: CareTaskType.APPOINTMENT,
      completionRule: { mode: 'canonical-consultation' },
      completionSourceType: 'consultation',
      completionSourceId: consultationId,
    });
    await expect(
      service.detail(
        actor(UserRole.PATIENT, patientId),
        String(appointment._id),
      ),
    ).resolves.toMatchObject({
      consultationReference: { consultationId: consultationId.toHexString() },
    });
  });

  it('atomically acknowledges configured education and replays the same key once', async () => {
    const enrollment = await createEnrollment(patientId, doctorId);
    const task = await createTask(enrollment._id);
    const now = new Date();
    const payload = { action: CareTaskResponseAction.ACKNOWLEDGE };
    const first = await service.respond(
      actor(UserRole.PATIENT, patientId),
      String(task._id),
      payload,
      'education-key',
      now,
    );
    const replay = await service.respond(
      actor(UserRole.PATIENT, patientId),
      String(task._id),
      payload,
      'education-key',
      now,
    );
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(first.task).toMatchObject({
      status: CareTaskStatus.COMPLETED,
      progress: { acknowledged: true, completionSource: 'patient_response' },
    });
    expect(await idempotency.countDocuments({ key: 'education-key' })).toBe(1);
    expect(
      await audits.countDocuments({
        entityId: task._id,
        action: 'care_task_response_submitted',
      }),
    ).toBe(1);
  });

  it('rejects key reuse, unsupported policy, terminal tasks and wrong owner', async () => {
    const enrollment = await createEnrollment(patientId, doctorId);
    const task = await createTask(enrollment._id);
    const other = await createTask(enrollment._id);
    await service.respond(
      actor(UserRole.PATIENT, patientId),
      String(task._id),
      { action: CareTaskResponseAction.ACKNOWLEDGE },
      'reused-key',
      new Date(),
    );
    await expect(
      service.respond(
        actor(UserRole.PATIENT, patientId),
        String(other._id),
        { action: CareTaskResponseAction.ACKNOWLEDGE },
        'reused-key',
        new Date(),
      ),
    ).rejects.toMatchObject({
      response: { code: 'CARE_IDEMPOTENCY_CONFLICT' },
    });

    const unsupported = await createTask(enrollment._id, {
      taskType: CareTaskType.CHECK_IN,
      completionRule: { mode: 'unspecified' },
    });
    await expect(
      service.respond(
        actor(UserRole.PATIENT, patientId),
        String(unsupported._id),
        { action: CareTaskResponseAction.ACKNOWLEDGE },
        'unsupported-key',
        new Date(),
      ),
    ).rejects.toMatchObject({
      response: { code: 'CARE_TASK_RESPONSE_POLICY_NOT_CONFIGURED' },
    });
    await expect(
      service.respond(
        actor(UserRole.PATIENT, otherPatientId),
        String(other._id),
        { action: CareTaskResponseAction.ACKNOWLEDGE },
        'wrong-owner-key',
        new Date(),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.respond(
        actor(UserRole.PATIENT, patientId),
        String(task._id),
        { action: CareTaskResponseAction.ACKNOWLEDGE },
        'terminal-key',
        new Date(),
      ),
    ).rejects.toMatchObject({ response: { code: 'CARE_TASK_TERMINAL' } });
  });

  it('allows only one concurrent transition and preserves adherence formula', async () => {
    const enrollment = await createEnrollment(patientId, doctorId);
    const task = await createTask(enrollment._id);
    const now = new Date();
    const results = await Promise.allSettled([
      service.respond(
        actor(UserRole.PATIENT, patientId),
        String(task._id),
        { action: CareTaskResponseAction.ACKNOWLEDGE },
        'race-a',
        now,
      ),
      service.respond(
        actor(UserRole.PATIENT, patientId),
        String(task._id),
        { action: CareTaskResponseAction.ACKNOWLEDGE },
        'race-b',
        now,
      ),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(await audits.countDocuments({ entityId: task._id })).toBe(1);
    await createTask(enrollment._id, {
      status: CareTaskStatus.MISSED,
      missedAt: new Date(),
    });
    const rate = await service.getCompletionRate(
      actor(UserRole.PATIENT, patientId),
      String(enrollment._id),
    );
    expect(rate).toEqual({
      expected: 2,
      completed: 1,
      missed: 1,
      completionRate: 0.5,
    });
  });

  it('accepts a bounded check-in and enqueues metadata without raw health values', async () => {
    const enrollment = await createEnrollment(patientId, doctorId);
    const task = await createTask(enrollment._id, {
      taskType: CareTaskType.CHECK_IN,
      completionRule: {
        responseMode: 'health_check_in',
        schemaVersion: 'health-check-in.v1',
        allowedSymptomCodes: ['dizziness', 'headache'],
      },
      contentRef: undefined,
    });
    const result = await service.respond(
      actor(UserRole.PATIENT, patientId),
      String(task._id),
      {
        overallStatus: HealthCheckInOverallStatus.WORSENED,
        symptomCodes: ['dizziness'],
        severity: HealthCheckInSeverity.SEVERE,
      },
      'check-in-key',
      new Date(),
    );
    expect(result.task).toMatchObject({ status: CareTaskStatus.COMPLETED });
    expect(enqueue).toHaveBeenCalledTimes(1);
    const event = enqueue.mock.calls[0][0];
    expect(event).toMatchObject({
      eventType: 'care.task.check_in.submitted.v1',
      payload: {
        eventVersion: 1,
        careTaskId: String(task._id),
        enrollmentId: String(enrollment._id),
        schemaVersion: 'health-check-in.v1',
      },
    });
    expect(JSON.stringify(event.payload)).not.toContain('dizziness');
    expect(JSON.stringify(event.payload)).not.toContain('severe');
  });

  it('rejects symptom codes outside the snapshot and inconsistent none severity', async () => {
    const enrollment = await createEnrollment(patientId, doctorId);
    const completionRule = {
      responseMode: 'health_check_in',
      schemaVersion: 'health-check-in.v1',
      allowedSymptomCodes: ['dizziness'],
    };
    const outside = await createTask(enrollment._id, {
      taskType: CareTaskType.CHECK_IN,
      completionRule,
      contentRef: undefined,
    });
    await expect(
      service.respond(
        actor(UserRole.PATIENT, patientId),
        String(outside._id),
        {
          overallStatus: HealthCheckInOverallStatus.STABLE,
          symptomCodes: ['unknown_symptom'],
          severity: HealthCheckInSeverity.MILD,
        },
        'outside-code',
      ),
    ).rejects.toMatchObject({
      response: { code: 'CARE_TASK_SYMPTOM_NOT_ALLOWED' },
    });
    const inconsistent = await createTask(enrollment._id, {
      taskType: CareTaskType.CHECK_IN,
      completionRule,
      contentRef: undefined,
    });
    await expect(
      service.respond(
        actor(UserRole.PATIENT, patientId),
        String(inconsistent._id),
        {
          overallStatus: HealthCheckInOverallStatus.STABLE,
          symptomCodes: ['dizziness'],
          severity: HealthCheckInSeverity.NONE,
        },
        'inconsistent',
      ),
    ).rejects.toMatchObject({
      response: { code: 'CARE_TASK_CHECK_IN_INCONSISTENT' },
    });
  });

  it('allows only the assigned Doctor to complete review and excludes it from adherence', async () => {
    const enrollment = await createEnrollment(patientId, doctorId);
    const task = await createTask(enrollment._id, {
      taskType: CareTaskType.DOCTOR_REVIEW,
      contentRef: undefined,
      completionRule: { responseMode: 'doctor_review' },
    });
    await expect(
      service.doctorReview(
        actor(UserRole.DOCTOR, otherDoctorId),
        String(task._id),
        { reasonCode: DoctorReviewReasonCode.FOLLOW_UP_NEEDED },
        'wrong-doctor-review',
      ),
    ).rejects.toMatchObject({ status: 404 });
    const completed = await service.doctorReview(
      actor(UserRole.DOCTOR, doctorId),
      String(task._id),
      {
        reasonCode: DoctorReviewReasonCode.FOLLOW_UP_NEEDED,
        note: 'Theo dõi lại trong lần kế tiếp.',
      },
      'doctor-review',
    );
    expect(completed.task).toMatchObject({
      status: CareTaskStatus.COMPLETED,
      progress: { completionSource: 'doctor_review' },
    });
    const rate = await service.getCompletionRate(
      actor(UserRole.PATIENT, patientId),
      String(enrollment._id),
    );
    expect(rate).toEqual({
      expected: 0,
      completed: 0,
      missed: 0,
      completionRate: null,
    });
    const detail = await service.detail(
      actor(UserRole.DOCTOR, doctorId),
      String(task._id),
    );
    expect(detail).not.toHaveProperty('response');
    expect(JSON.stringify(detail)).not.toContain('Theo dõi lại');
  });

  it('allows only one concurrent Doctor review completion', async () => {
    const enrollment = await createEnrollment(patientId, doctorId);
    const task = await createTask(enrollment._id, {
      taskType: CareTaskType.DOCTOR_REVIEW,
      contentRef: undefined,
      completionRule: { responseMode: 'doctor_review' },
    });
    const results = await Promise.allSettled([
      service.doctorReview(
        actor(UserRole.DOCTOR, doctorId),
        String(task._id),
        { reasonCode: DoctorReviewReasonCode.REVIEWED_NO_ACTION },
        'review-race-a',
      ),
      service.doctorReview(
        actor(UserRole.DOCTOR, doctorId),
        String(task._id),
        { reasonCode: DoctorReviewReasonCode.FOLLOW_UP_NEEDED },
        'review-race-b',
      ),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(
      await audits.countDocuments({
        entityId: task._id,
        action: 'care_task_doctor_review_completed',
      }),
    ).toBe(1);
  });

  it('links an owned appointment task to one canonical Consultation', async () => {
    const enrollment = await createEnrollment(patientId, doctorId);
    const task = await createTask(enrollment._id, {
      taskType: CareTaskType.APPOINTMENT,
      contentRef: undefined,
      completionRule: { responseMode: 'canonical_consultation' },
    });
    const consultationId = new ObjectId();
    const result = await service.linkAppointment(
      actor(UserRole.PATIENT, patientId),
      String(task._id),
      String(consultationId),
      'appointment-link',
    );
    expect(result.task).toMatchObject({
      progress: {
        completionSource: 'consultation',
      },
      consultationReference: { consultationId: String(consultationId) },
    });
    expect(linkCareTask).toHaveBeenCalledWith(
      expect.objectContaining({
        careTaskId: String(task._id),
        consultationId: String(consultationId),
        patientId: String(patientId),
        doctorId: String(doctorId),
        session: expect.anything(),
      }),
    );
    const replay = await service.linkAppointment(
      actor(UserRole.PATIENT, patientId),
      String(task._id),
      String(consultationId),
      'appointment-link',
    );
    expect(replay.replayed).toBe(true);
    expect(linkCareTask).toHaveBeenCalledTimes(1);
    await expect(
      service.linkAppointment(
        actor(UserRole.PATIENT, otherPatientId),
        String(task._id),
        String(consultationId),
        'appointment-cross-owner',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('fails closed when immutable education content cannot be resolved', async () => {
    const enrollment = await createEnrollment(patientId, doctorId);
    const task = await createTask(enrollment._id, {
      contentRef: {
        contentId: 'missing_content',
        version: '1.0.0',
        locale: 'vi-VN',
        displayType: 'article',
      },
    });
    const detail = await service.detail(
      actor(UserRole.PATIENT, patientId),
      String(task._id),
    );
    expect(detail).toMatchObject({
      allowedActions: [],
      presentation: { reasonCode: 'CARE_TASK_CONTENT_UNAVAILABLE' },
    });
    await expect(
      service.respond(
        actor(UserRole.PATIENT, patientId),
        String(task._id),
        { action: CareTaskResponseAction.ACKNOWLEDGE },
        'missing-content',
      ),
    ).rejects.toMatchObject({
      response: { code: 'CARE_TASK_CONTENT_UNAVAILABLE' },
    });
  });

  it('normalizes persisted check-in values into scalar rule facts', async () => {
    const enrollment = await createEnrollment(patientId, doctorId);
    const completedAt = new Date();
    const task = await createTask(enrollment._id, {
      taskType: CareTaskType.CHECK_IN,
      status: CareTaskStatus.COMPLETED,
      completedAt,
      completionSourceType: 'patientResponse',
      contentRef: undefined,
      response: {
        kind: 'health_check_in_v1',
        schemaVersion: 'health-check-in.v1',
        overallStatus: 'worsened',
        symptomCodes: ['dizziness'],
        severity: 'severe',
        submittedAt: completedAt,
      },
    });
    await eventService.evaluateCheckIn(
      String(task._id),
      String(enrollment._id),
    );
    expect(evaluateCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({
        careTaskId: String(task._id),
        enrollmentId: String(enrollment._id),
        facts: {
          'check_in.overall_status': 'worsened',
          'check_in.severity': 'severe',
          'check_in.severity_rank': 3,
          'check_in.symptom.dizziness': true,
        },
      }),
    );
  });

  it('applies canonical Consultation outcomes and fails closed for ambiguous cancellation', async () => {
    const enrollment = await createEnrollment(patientId, doctorId);
    const completed = await createTask(enrollment._id, {
      taskType: CareTaskType.APPOINTMENT,
      contentRef: undefined,
    });
    const consultationId = new ObjectId();
    await eventService.applyConsultationLifecycle({
      careTaskId: String(completed._id),
      consultationId: String(consultationId),
      outcome: 'completed',
      occurredAt: new Date().toISOString(),
    });
    expect(await tasks.findById(completed._id).lean()).toMatchObject({
      status: CareTaskStatus.COMPLETED,
      completionSourceType: 'consultation',
      completionSourceId: consultationId,
    });

    const cancelled = await createTask(enrollment._id, {
      taskType: CareTaskType.APPOINTMENT,
      contentRef: undefined,
    });
    await eventService.applyConsultationLifecycle({
      careTaskId: String(cancelled._id),
      consultationId: String(new ObjectId()),
      outcome: 'cancelled',
      occurredAt: new Date().toISOString(),
      objectiveDisposition: 'unknown',
    });
    expect((await tasks.findById(cancelled._id).lean())?.status).toBe(
      CareTaskStatus.DUE,
    );

    await eventService.applyConsultationLifecycle({
      careTaskId: String(cancelled._id),
      consultationId: String(new ObjectId()),
      outcome: 'cancelled',
      occurredAt: new Date().toISOString(),
      objectiveDisposition: 'no_longer_required',
    });
    expect(await tasks.findById(cancelled._id).lean()).toMatchObject({
      status: CareTaskStatus.CANCELLED,
      cancellationReason: 'care_objective_no_longer_required',
    });

    const missed = await createTask(enrollment._id, {
      taskType: CareTaskType.APPOINTMENT,
      contentRef: undefined,
    });
    const missedConsultationId = new ObjectId();
    await eventService.applyConsultationLifecycle({
      careTaskId: String(missed._id),
      consultationId: String(missedConsultationId),
      outcome: 'no_show',
      occurredAt: new Date().toISOString(),
    });
    expect(await tasks.findById(missed._id).lean()).toMatchObject({
      status: CareTaskStatus.MISSED,
      completionSourceId: missedConsultationId,
    });

    const rescheduled = await createTask(enrollment._id, {
      taskType: CareTaskType.APPOINTMENT,
      contentRef: undefined,
    });
    const rescheduledConsultationId = new ObjectId();
    await eventService.applyConsultationLifecycle({
      careTaskId: String(rescheduled._id),
      consultationId: String(rescheduledConsultationId),
      outcome: 'rescheduled',
      occurredAt: new Date().toISOString(),
    });
    expect(await tasks.findById(rescheduled._id).lean()).toMatchObject({
      status: CareTaskStatus.DUE,
      completionSourceType: 'consultation',
      completionSourceId: rescheduledConsultationId,
    });
  });

  async function createEnrollment(patient: ObjectId, doctor: ObjectId) {
    return enrollments.create({
      revision: 1,
      patientId: patient,
      doctorId: doctor,
      careProgramId: new ObjectId(),
      careRuleId: new ObjectId(),
      status: PatientCareProgramStatus.ACTIVE,
      timezone: 'Asia/Ho_Chi_Minh',
      consent: { accepted: true },
      programConfig: { programCode: 'HTN-CARE', version: 1 },
      startedAt: new Date(),
      createdBy: doctor,
    });
  }

  async function createTask(
    enrollmentId: ObjectId,
    overrides: Record<string, unknown> = {},
  ) {
    const now = new Date();
    return tasks.create({
      patientCareProgramId: enrollmentId,
      patientId,
      doctorId,
      templateKey: `education-${randomUUID()}`,
      taskType: CareTaskType.EDUCATION,
      status: CareTaskStatus.DUE,
      required: true,
      scheduleVersion: 'v1',
      scheduledFor: now,
      windowStart: new Date(now.getTime() - 60_000),
      windowEnd: new Date(now.getTime() + 60_000),
      completionRule: { responseMode: 'acknowledge' },
      contentRef: {
        contentId: 'approved_education',
        version: '1.0.0',
        locale: 'vi-VN',
        displayType: 'article',
      },
      reminderPolicy: { enabled: false },
      uniqueKey: randomUUID(),
      ...overrides,
    });
  }
});

function actor(role: UserRole, id: ObjectId) {
  return { id: id.toHexString(), role };
}

function query(overrides: Record<string, unknown> = {}) {
  return {
    page: 1,
    limit: 20,
    sortBy: 'scheduledFor' as const,
    sortOrder: -1 as const,
    ...overrides,
  };
}
