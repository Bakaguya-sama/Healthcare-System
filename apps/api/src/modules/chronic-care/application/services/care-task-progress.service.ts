import { createHash } from 'node:crypto';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import type { PageResult } from '../../../../common/pagination';
import { UserRole } from '../../../../core/domain/user.enums';
import { AuditLog } from '../../../platform-audit/public-api';
import { OutboxService } from '../../../../infrastructure/outbox/outbox.service';
import {
  CareCommandIdempotency,
  CareCommandIdempotencyDocument,
} from '../../domain/entities/care-command-idempotency.entity';
import {
  CareTask,
  CareTaskDocument,
  CareTaskStatus,
  CareTaskType,
} from '../../domain/entities/care-task.entity';
import {
  PatientCareProgram,
  PatientCareProgramDocument,
  PatientCareProgramStatus,
} from '../../domain/entities/patient-care-program.entity';
import {
  CareTaskResponseAction,
  QueryEnrollmentCareTasksDto,
  SubmitCareTaskResponseDto,
  SubmitDoctorReviewDto,
  HealthCheckInSeverity,
} from '../../presentation/dto/care-task.dto';
import {
  CONTENT_CATALOG_PORT,
  type ContentCatalogPort,
  type EducationContentRef,
} from '../ports/content-catalog.port';
import {
  checkInAllowedSymptoms,
  HEALTH_CHECK_IN_SCHEMA_VERSION,
} from '../../domain/tasks/care-task-template.validator';
import {
  CARE_TASK_CONSULTATION_PORT,
  type CareTaskConsultationPort,
} from '../../../consultations/public-api';
import { DOCTOR_REPOSITORY_PORT } from '../ports/doctor.repository.port';
import type { DoctorRepositoryPort } from '../ports/doctor.repository.port';
import { PATIENT_REPOSITORY_PORT } from '../ports/patient.repository.port';
import type { PatientRepositoryPort } from '../ports/patient.repository.port';
import type { CareActor } from './care-program-rule.service';

type PlainTask = Record<string, unknown> & {
  _id: Types.ObjectId;
  patientCareProgramId: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId?: Types.ObjectId;
  taskType: CareTaskType;
  status: CareTaskStatus;
  templateKey: string;
  required: boolean;
  scheduledFor: Date;
  windowStart: Date;
  windowEnd: Date;
  completionRule: Record<string, unknown>;
  contentRef?: EducationContentRef;
  completionSourceId?: Types.ObjectId;
  completionSourceType?: string;
  response?: Record<string, unknown>;
  completedAt?: Date;
  missedAt?: Date;
  cancelledAt?: Date;
};

@Injectable()
export class CareTaskProgressService {
  constructor(
    @InjectModel(CareTask.name)
    private readonly tasks: Model<CareTaskDocument>,
    @InjectModel(PatientCareProgram.name)
    private readonly enrollments: Model<PatientCareProgramDocument>,
    @InjectModel(CareCommandIdempotency.name)
    private readonly idempotency: Model<CareCommandIdempotencyDocument>,
    @InjectModel(AuditLog.name) private readonly audits: Model<AuditLog>,
    @InjectConnection() private readonly connection: Connection,
    @Inject(PATIENT_REPOSITORY_PORT)
    private readonly patients: PatientRepositoryPort,
    @Inject(DOCTOR_REPOSITORY_PORT)
    private readonly doctors: DoctorRepositoryPort,
    @Optional() private readonly outbox?: OutboxService,
    @Optional()
    @Inject(CONTENT_CATALOG_PORT)
    private readonly contentCatalog?: ContentCatalogPort,
    @Optional()
    @Inject(CARE_TASK_CONSULTATION_PORT)
    private readonly consultationLinks?: CareTaskConsultationPort,
  ) {}

  async list(
    actor: CareActor,
    enrollmentId: string,
    query: QueryEnrollmentCareTasksDto,
  ): Promise<PageResult<Record<string, unknown>>> {
    const enrollment = await this.authorizedEnrollment(actor, enrollmentId);
    const filter: Record<string, unknown> = {
      patientCareProgramId: enrollment._id,
    };
    if (query.status) filter.status = query.status;
    if (query.type) filter.taskType = query.type;
    if (query.from || query.to) {
      const range: Record<string, Date> = {};
      if (query.from) range.$gte = new Date(query.from);
      if (query.to) range.$lte = new Date(query.to);
      if (range.$gte && range.$lte && range.$gte > range.$lte)
        this.fail(
          'CARE_TASK_DATE_RANGE_INVALID',
          HttpStatus.BAD_REQUEST,
          'from must be before or equal to to',
        );
      filter.scheduledFor = range;
    }
    const sort = {
      [query.sortBy]: query.sortOrder,
      _id: query.sortOrder,
    } as Record<string, 1 | -1>;
    const [rows, total] = await Promise.all([
      this.tasks
        .find(filter)
        .sort(sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean()
        .exec(),
      this.tasks.countDocuments(filter).exec(),
    ]);
    const now = new Date();
    return {
      items: await Promise.all(
        rows.map((row) =>
          this.summary(actor, row as unknown as PlainTask, now),
        ),
      ),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async detail(actor: CareActor, taskId: string) {
    const task = await this.taskForActor(actor, taskId);
    return this.detailProjection(actor, task, new Date());
  }

  async getCompletionRate(actor: CareActor, enrollmentId: string) {
    const enrollment = await this.authorizedEnrollment(actor, enrollmentId);
    const counts = await this.tasks.aggregate<{
      _id: CareTaskStatus;
      count: number;
    }>([
      {
        $match: {
          patientCareProgramId: enrollment._id,
          required: true,
          taskType: { $ne: CareTaskType.DOCTOR_REVIEW },
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const byStatus = Object.fromEntries(
      counts.map((item) => [item._id, item.count]),
    );
    const completed = byStatus[CareTaskStatus.COMPLETED] ?? 0;
    const missed = byStatus[CareTaskStatus.MISSED] ?? 0;
    return {
      expected: completed + missed,
      completed,
      missed,
      completionRate:
        completed + missed ? completed / (completed + missed) : null,
    };
  }

  async respond(
    actor: CareActor,
    taskId: string,
    input: SubmitCareTaskResponseDto,
    idempotencyKey: string,
    now = new Date(),
  ): Promise<{ task: Record<string, unknown>; replayed: boolean }> {
    if (actor.role !== UserRole.PATIENT)
      this.notFound('CARE_TASK_NOT_FOUND', 'Care Task not found');
    if (!(await this.patients.isActive(actor.id)))
      this.notFound('CARE_TASK_NOT_FOUND', 'Care Task not found');
    if (!idempotencyKey?.trim())
      this.fail(
        'CARE_IDEMPOTENCY_KEY_REQUIRED',
        HttpStatus.BAD_REQUEST,
        'Idempotency-Key is required',
      );

    const actorId = this.objectId(actor.id, 'CARE_TASK_NOT_FOUND');
    const taskObjectId = this.objectId(taskId, 'CARE_TASK_NOT_FOUND');
    const operation = 'careTask.respond';
    const requestHash = this.hash({ taskId, input });
    const session = await this.connection.startSession();
    let result!: PlainTask;
    let replayed = false;
    try {
      await session.withTransaction(async () => {
        const old = await this.idempotency
          .findOne({ actorId, operation, key: idempotencyKey })
          .session(session)
          .lean()
          .exec();
        if (old) {
          if (old.requestHash !== requestHash)
            this.fail(
              'CARE_IDEMPOTENCY_CONFLICT',
              HttpStatus.CONFLICT,
              'Idempotency-Key was already used with another payload',
            );
          const replay = await this.tasks
            .findOne({ _id: old.entityId, patientId: actorId })
            .session(session)
            .lean()
            .exec();
          if (!replay)
            this.notFound('CARE_TASK_NOT_FOUND', 'Care Task not found');
          result = replay as unknown as PlainTask;
          replayed = true;
          return;
        }

        const current = await this.tasks
          .findOne({ _id: taskObjectId, patientId: actorId })
          .session(session)
          .lean()
          .exec();
        if (!current)
          this.notFound('CARE_TASK_NOT_FOUND', 'Care Task not found');
        const task = current as unknown as PlainTask;
        const enrollment = await this.enrollments
          .findOne({
            _id: task.patientCareProgramId,
            patientId: actorId,
            status: PatientCareProgramStatus.ACTIVE,
          })
          .session(session)
          .lean()
          .exec();
        if (!enrollment)
          this.fail(
            'CARE_TASK_ENROLLMENT_NOT_ACTIVE',
            HttpStatus.CONFLICT,
            'Care Enrollment is not active',
          );
        const response = await this.responseFor(task, input, now);
        if (
          ![CareTaskStatus.SCHEDULED, CareTaskStatus.DUE].includes(task.status)
        )
          this.fail(
            'CARE_TASK_TERMINAL',
            HttpStatus.CONFLICT,
            'Care Task no longer accepts responses',
          );
        if (now < new Date(task.windowStart) || now > new Date(task.windowEnd))
          this.fail(
            'CARE_TASK_OUTSIDE_RESPONSE_WINDOW',
            HttpStatus.CONFLICT,
            'Care Task is outside its response window',
          );

        const updated = await this.tasks
          .findOneAndUpdate(
            {
              _id: taskObjectId,
              patientId: actorId,
              status: {
                $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE],
              },
              windowStart: { $lte: now },
              windowEnd: { $gte: now },
            },
            {
              $set: {
                status: CareTaskStatus.COMPLETED,
                completedAt: now,
                completionSourceType: 'patientResponse',
                response,
              },
            },
            { returnDocument: 'after', session },
          )
          .lean()
          .exec();
        if (!updated)
          this.fail(
            'CARE_TASK_CONCURRENT_TRANSITION',
            HttpStatus.CONFLICT,
            'Care Task was already transitioned',
          );
        result = updated as unknown as PlainTask;
        await this.audits.create(
          [
            {
              domain: 'care',
              entityType: 'careTask',
              entityId: taskObjectId,
              actorId,
              action: 'care_task_response_submitted',
              fromStatus: task.status,
              toStatus: CareTaskStatus.COMPLETED,
              metadata: { taskType: task.taskType },
            },
          ],
          { session },
        );
        await this.idempotency.create(
          [
            {
              actorId,
              operation,
              key: idempotencyKey,
              requestHash,
              entityType: 'careTask',
              entityId: taskObjectId,
            },
          ],
          { session },
        );
        if (task.taskType === CareTaskType.CHECK_IN)
          await this.outbox?.enqueue(
            {
              eventType: 'care.task.check_in.submitted.v1',
              aggregateType: 'careTask',
              aggregateId: taskObjectId,
              idempotencyKey: `care.task.check_in.evaluate.${taskObjectId}`,
              payload: {
                eventVersion: 1,
                careTaskId: String(taskObjectId),
                enrollmentId: String(task.patientCareProgramId),
                schemaVersion: HEALTH_CHECK_IN_SCHEMA_VERSION,
                submittedAt: now.toISOString(),
              },
            },
            session,
          );
      });
    } finally {
      await session.endSession();
    }
    return {
      task: await this.detailProjection(actor, result, now),
      replayed,
    };
  }

  async doctorReview(
    actor: CareActor,
    taskId: string,
    input: SubmitDoctorReviewDto,
    idempotencyKey: string,
    now = new Date(),
  ): Promise<{ task: Record<string, unknown>; replayed: boolean }> {
    if (actor.role !== UserRole.DOCTOR)
      this.notFound('CARE_TASK_NOT_FOUND', 'Care Task not found');
    if (!(await this.doctors.isActiveAndApproved(actor.id)))
      this.notFound('CARE_TASK_NOT_FOUND', 'Care Task not found');
    if (!idempotencyKey?.trim())
      this.fail(
        'CARE_IDEMPOTENCY_KEY_REQUIRED',
        HttpStatus.BAD_REQUEST,
        'Idempotency-Key is required',
      );

    const actorId = this.objectId(actor.id, 'CARE_TASK_NOT_FOUND');
    const taskObjectId = this.objectId(taskId, 'CARE_TASK_NOT_FOUND');
    const operation = 'careTask.doctorReview';
    const requestHash = this.hash({ taskId, input });
    const session = await this.connection.startSession();
    let result!: PlainTask;
    let replayed = false;
    try {
      await session.withTransaction(async () => {
        const old = await this.idempotency
          .findOne({ actorId, operation, key: idempotencyKey })
          .session(session)
          .lean()
          .exec();
        if (old) {
          if (old.requestHash !== requestHash)
            this.fail(
              'CARE_IDEMPOTENCY_CONFLICT',
              HttpStatus.CONFLICT,
              'Idempotency-Key was already used with another payload',
            );
          const replay = await this.tasks
            .findOne({ _id: old.entityId, doctorId: actorId })
            .session(session)
            .lean()
            .exec();
          if (!replay)
            this.notFound('CARE_TASK_NOT_FOUND', 'Care Task not found');
          result = replay as unknown as PlainTask;
          replayed = true;
          return;
        }

        const current = await this.tasks
          .findOne({ _id: taskObjectId, doctorId: actorId })
          .session(session)
          .lean()
          .exec();
        if (!current)
          this.notFound('CARE_TASK_NOT_FOUND', 'Care Task not found');
        const task = current as unknown as PlainTask;
        if (task.taskType !== CareTaskType.DOCTOR_REVIEW)
          this.fail(
            'CARE_TASK_RESPONSE_POLICY_NOT_CONFIGURED',
            HttpStatus.UNPROCESSABLE_ENTITY,
            'Task is not a Doctor Review task',
          );
        const enrollment = await this.enrollments
          .findOne({
            _id: task.patientCareProgramId,
            doctorId: actorId,
            status: PatientCareProgramStatus.ACTIVE,
          })
          .session(session)
          .lean()
          .exec();
        if (!enrollment)
          this.fail(
            'CARE_TASK_ENROLLMENT_NOT_ACTIVE',
            HttpStatus.CONFLICT,
            'Care Enrollment is not active',
          );
        this.assertOpenWindow(task, now);
        const updated = await this.tasks
          .findOneAndUpdate(
            {
              _id: taskObjectId,
              doctorId: actorId,
              taskType: CareTaskType.DOCTOR_REVIEW,
              status: { $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE] },
              windowStart: { $lte: now },
              windowEnd: { $gte: now },
            },
            {
              $set: {
                status: CareTaskStatus.COMPLETED,
                completedAt: now,
                completionSourceType: 'doctorReview',
                completionSourceId: actorId,
                response: {
                  kind: 'doctor_review',
                  reasonCode: input.reasonCode,
                  ...(input.note ? { note: input.note } : {}),
                  reviewedAt: now,
                },
              },
            },
            { returnDocument: 'after', session },
          )
          .lean()
          .exec();
        if (!updated)
          this.fail(
            'CARE_TASK_CONCURRENT_TRANSITION',
            HttpStatus.CONFLICT,
            'Care Task was already transitioned',
          );
        result = updated as unknown as PlainTask;
        await this.audits.create(
          [
            {
              domain: 'care',
              entityType: 'careTask',
              entityId: taskObjectId,
              actorId,
              action: 'care_task_doctor_review_completed',
              fromStatus: task.status,
              toStatus: CareTaskStatus.COMPLETED,
              metadata: { reasonCode: input.reasonCode },
            },
          ],
          { session },
        );
        await this.idempotency.create(
          [
            {
              actorId,
              operation,
              key: idempotencyKey,
              requestHash,
              entityType: 'careTask',
              entityId: taskObjectId,
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    return {
      task: await this.detailProjection(actor, result, now),
      replayed,
    };
  }

  async linkAppointment(
    actor: CareActor,
    taskId: string,
    consultationId: string,
    idempotencyKey: string,
    now = new Date(),
  ): Promise<{ task: Record<string, unknown>; replayed: boolean }> {
    if (actor.role !== UserRole.PATIENT)
      this.notFound('CARE_TASK_NOT_FOUND', 'Care Task not found');
    if (!(await this.patients.isActive(actor.id)))
      this.notFound('CARE_TASK_NOT_FOUND', 'Care Task not found');
    if (!this.consultationLinks)
      this.fail(
        'CARE_TASK_RESPONSE_POLICY_NOT_CONFIGURED',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Appointment linking is unavailable',
      );
    if (!idempotencyKey?.trim())
      this.fail(
        'CARE_IDEMPOTENCY_KEY_REQUIRED',
        HttpStatus.BAD_REQUEST,
        'Idempotency-Key is required',
      );
    const actorId = this.objectId(actor.id, 'CARE_TASK_NOT_FOUND');
    const taskObjectId = this.objectId(taskId, 'CARE_TASK_NOT_FOUND');
    const consultationObjectId = this.objectId(
      consultationId,
      'CARE_TASK_CONSULTATION_NOT_FOUND',
    );
    const operation = 'careTask.linkAppointment';
    const requestHash = this.hash({ taskId, consultationId });
    const session = await this.connection.startSession();
    let result!: PlainTask;
    let replayed = false;
    try {
      await session.withTransaction(async () => {
        const old = await this.idempotency
          .findOne({ actorId, operation, key: idempotencyKey })
          .session(session)
          .lean()
          .exec();
        if (old) {
          if (old.requestHash !== requestHash)
            this.fail(
              'CARE_IDEMPOTENCY_CONFLICT',
              HttpStatus.CONFLICT,
              'Idempotency-Key was already used with another payload',
            );
          const replay = await this.tasks
            .findOne({ _id: old.entityId, patientId: actorId })
            .session(session)
            .lean()
            .exec();
          if (!replay)
            this.notFound('CARE_TASK_NOT_FOUND', 'Care Task not found');
          result = replay as unknown as PlainTask;
          replayed = true;
          return;
        }
        const task = (await this.tasks
          .findOne({
            _id: taskObjectId,
            patientId: actorId,
            taskType: CareTaskType.APPOINTMENT,
          })
          .session(session)
          .lean()
          .exec()) as unknown as PlainTask | null;
        if (!task)
          this.notFound('CARE_TASK_NOT_FOUND', 'Care Task not found');
        if (
          ![CareTaskStatus.SCHEDULED, CareTaskStatus.DUE].includes(task.status)
        )
          this.fail(
            'CARE_TASK_TERMINAL',
            HttpStatus.CONFLICT,
            'Care Task can no longer be linked',
          );
        if (!task.doctorId)
          this.fail(
            'CARE_TASK_RESPONSE_POLICY_NOT_CONFIGURED',
            HttpStatus.UNPROCESSABLE_ENTITY,
            'Appointment task has no assigned Doctor',
          );
        const enrollment = await this.enrollments
          .findOne({
            _id: task.patientCareProgramId,
            patientId: actorId,
            doctorId: task.doctorId,
            status: PatientCareProgramStatus.ACTIVE,
          })
          .session(session)
          .lean()
          .exec();
        if (!enrollment)
          this.fail(
            'CARE_TASK_ENROLLMENT_NOT_ACTIVE',
            HttpStatus.CONFLICT,
            'Care Enrollment is not active',
          );
        await this.consultationLinks!.linkCareTask({
          consultationId,
          careTaskId: taskId,
          patientId: actor.id,
          doctorId: String(task.doctorId),
          session,
        });
        const updated = await this.tasks
          .findOneAndUpdate(
            {
              _id: taskObjectId,
              patientId: actorId,
              taskType: CareTaskType.APPOINTMENT,
              status: { $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE] },
              $or: [
                { completionSourceId: { $exists: false } },
                { completionSourceId: consultationObjectId },
              ],
            },
            {
              $set: {
                completionSourceType: 'consultation',
                completionSourceId: consultationObjectId,
              },
            },
            { returnDocument: 'after', session },
          )
          .lean()
          .exec();
        if (!updated)
          this.fail(
            'CARE_TASK_CONCURRENT_TRANSITION',
            HttpStatus.CONFLICT,
            'Appointment task was concurrently linked',
          );
        result = updated as unknown as PlainTask;
        await this.audits.create(
          [
            {
              domain: 'care',
              entityType: 'careTask',
              entityId: taskObjectId,
              actorId,
              action: 'care_task_consultation_linked',
              metadata: { consultationId },
            },
          ],
          { session },
        );
        await this.idempotency.create(
          [
            {
              actorId,
              operation,
              key: idempotencyKey,
              requestHash,
              entityType: 'careTask',
              entityId: taskObjectId,
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    return {
      task: await this.detailProjection(actor, result, now),
      replayed,
    };
  }

  private async responseFor(
    task: PlainTask,
    input: SubmitCareTaskResponseDto,
    now: Date,
  ): Promise<Record<string, unknown>> {
    if (task.taskType === CareTaskType.METRIC)
      this.fail(
        'CARE_TASK_RESPONSE_USE_HEALTH_METRIC',
        HttpStatus.CONFLICT,
        'Metric tasks must be completed through Health Tracking (HLTH-02)',
      );
    if (task.taskType === CareTaskType.CHECK_IN) {
      if (!this.outbox)
        this.fail(
          'CARE_TASK_RESPONSE_POLICY_NOT_CONFIGURED',
          HttpStatus.UNPROCESSABLE_ENTITY,
          'Check-in evaluation delivery is unavailable',
        );
      const allowed = checkInAllowedSymptoms(task.completionRule);
      if (!allowed)
        this.fail(
          'CARE_TASK_RESPONSE_POLICY_NOT_CONFIGURED',
          HttpStatus.UNPROCESSABLE_ENTITY,
          'No approved check-in policy is configured for this task',
        );
      if (
        input.action !== undefined ||
        input.overallStatus === undefined ||
        input.symptomCodes === undefined ||
        input.severity === undefined
      )
        this.fail(
          'CARE_TASK_RESPONSE_INVALID',
          HttpStatus.BAD_REQUEST,
          'Check-in must contain exactly overallStatus, symptomCodes and severity',
        );
      if (input.symptomCodes.some((code) => !allowed.includes(code)))
        this.fail(
          'CARE_TASK_SYMPTOM_NOT_ALLOWED',
          HttpStatus.UNPROCESSABLE_ENTITY,
          'Check-in contains a symptom code outside the task snapshot',
        );
      const none = input.severity === HealthCheckInSeverity.NONE;
      if (none !== (input.symptomCodes.length === 0))
        this.fail(
          'CARE_TASK_CHECK_IN_INCONSISTENT',
          HttpStatus.UNPROCESSABLE_ENTITY,
          'severity none is only valid with an empty symptom list',
        );
      return {
        kind: 'health_check_in_v1',
        schemaVersion: HEALTH_CHECK_IN_SCHEMA_VERSION,
        overallStatus: input.overallStatus,
        symptomCodes: input.symptomCodes,
        severity: input.severity,
        submittedAt: now,
      };
    }
    if (
      task.taskType !== CareTaskType.EDUCATION ||
      task.completionRule?.responseMode !== 'acknowledge' ||
      !task.contentRef
    )
      this.fail(
        'CARE_TASK_RESPONSE_POLICY_NOT_CONFIGURED',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'No approved response policy is configured for this task',
      );
    if (
      !this.contentCatalog ||
      !(await this.contentCatalog.resolvePublished(task.contentRef))
    )
      this.fail(
        'CARE_TASK_CONTENT_UNAVAILABLE',
        HttpStatus.CONFLICT,
        'The immutable education content is unavailable',
      );
    if (
      input.action !== CareTaskResponseAction.ACKNOWLEDGE ||
      input.overallStatus !== undefined ||
      input.symptomCodes !== undefined ||
      input.severity !== undefined
    )
      this.fail(
        'CARE_TASK_RESPONSE_INVALID',
        HttpStatus.BAD_REQUEST,
        'Unsupported response action',
      );
    return {
      kind: 'education_acknowledgement',
      action: CareTaskResponseAction.ACKNOWLEDGE,
      acknowledgedAt: now,
      contentRef: task.contentRef,
    };
  }

  private assertOpenWindow(task: PlainTask, now: Date) {
    if (![CareTaskStatus.SCHEDULED, CareTaskStatus.DUE].includes(task.status))
      this.fail(
        'CARE_TASK_TERMINAL',
        HttpStatus.CONFLICT,
        'Care Task no longer accepts responses',
      );
    if (now < new Date(task.windowStart) || now > new Date(task.windowEnd))
      this.fail(
        'CARE_TASK_OUTSIDE_RESPONSE_WINDOW',
        HttpStatus.CONFLICT,
        'Care Task is outside its response window',
      );
  }

  private async taskForActor(actor: CareActor, taskId: string) {
    const objectId = this.objectId(taskId, 'CARE_TASK_NOT_FOUND');
    const actorId = this.objectId(actor.id, 'CARE_TASK_NOT_FOUND');
    const filter: Record<string, unknown> = { _id: objectId };
    if (actor.role === UserRole.PATIENT) {
      if (!(await this.patients.isActive(actor.id)))
        this.notFound('CARE_TASK_NOT_FOUND', 'Care Task not found');
      filter.patientId = actorId;
    } else if (actor.role === UserRole.DOCTOR) {
      if (!(await this.doctors.isActiveAndApproved(actor.id)))
        this.notFound('CARE_TASK_NOT_FOUND', 'Care Task not found');
      filter.doctorId = actorId;
    } else {
      this.notFound('CARE_TASK_NOT_FOUND', 'Care Task not found');
    }
    const task = await this.tasks.findOne(filter).lean().exec();
    if (!task) this.notFound('CARE_TASK_NOT_FOUND', 'Care Task not found');
    await this.authorizedEnrollment(actor, String(task.patientCareProgramId));
    return task as unknown as PlainTask;
  }

  private async authorizedEnrollment(actor: CareActor, enrollmentId: string) {
    const objectId = this.objectId(enrollmentId, 'CARE_ENROLLMENT_NOT_FOUND');
    const actorId = this.objectId(actor.id, 'CARE_ENROLLMENT_NOT_FOUND');
    const filter: Record<string, unknown> = { _id: objectId };
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
    const enrollment = await this.enrollments.findOne(filter).lean().exec();
    if (!enrollment)
      this.notFound('CARE_ENROLLMENT_NOT_FOUND', 'Care Enrollment not found');
    return enrollment;
  }

  private async summary(actor: CareActor, task: PlainTask, now: Date) {
    return {
      id: String(task._id),
      enrollmentId: String(task.patientCareProgramId),
      taskType: task.taskType,
      templateKey: task.templateKey,
      status: task.status,
      required: task.required,
      scheduledFor: this.iso(task.scheduledFor),
      windowStart: this.iso(task.windowStart),
      windowEnd: this.iso(task.windowEnd),
      completedAt: this.iso(task.completedAt),
      missedAt: this.iso(task.missedAt),
      cancelledAt: this.iso(task.cancelledAt),
      allowedActions: await this.allowedActions(actor, task, now),
    };
  }

  private async detailProjection(actor: CareActor, task: PlainTask, now: Date) {
    const detail: Record<string, unknown> = {
      ...(await this.summary(actor, task, now)),
      presentation: await this.presentation(task),
      progress: {
        status: task.status,
        completedAt: this.iso(task.completedAt),
        completionSource:
          task.completionSourceType === 'patientResponse'
            ? 'patient_response'
            : task.completionSourceType === 'healthMetric'
              ? 'health_metric'
              : task.completionSourceType === 'doctorReview'
                ? 'doctor_review'
                : task.completionSourceType === 'consultation'
                  ? 'consultation'
              : undefined,
        acknowledged:
          task.taskType === CareTaskType.EDUCATION &&
          task.status === CareTaskStatus.COMPLETED &&
          task.completionSourceType === 'patientResponse',
      },
    };
    if (
      task.taskType === CareTaskType.APPOINTMENT &&
      task.completionSourceType === 'consultation' &&
      task.completionSourceId
    )
      detail.consultationReference = {
        consultationId: String(task.completionSourceId),
      };
    return detail;
  }

  private async presentation(task: PlainTask): Promise<Record<string, unknown>> {
    if (task.taskType === CareTaskType.METRIC)
      return {
        kind: 'metric',
        metricType: task.completionRule?.metricType,
        responseEndpoint: 'HLTH-02',
      };
    if (task.taskType === CareTaskType.CHECK_IN) {
      const allowedSymptomCodes = checkInAllowedSymptoms(task.completionRule);
      if (allowedSymptomCodes)
        return {
          kind: 'check_in',
          schemaVersion: HEALTH_CHECK_IN_SCHEMA_VERSION,
          overallStatuses: ['improved', 'stable', 'worsened'],
          severities: ['none', 'mild', 'moderate', 'severe'],
          allowedSymptomCodes,
        };
    }
    if (
      task.taskType === CareTaskType.EDUCATION &&
      task.completionRule?.responseMode === 'acknowledge' &&
      task.contentRef
    ) {
      const content = await this.contentCatalog?.resolvePublished(task.contentRef);
      if (content)
        return { kind: 'education', responseMode: 'acknowledge', content };
      return {
        kind: 'education',
        responseConfigured: false,
        reasonCode: 'CARE_TASK_CONTENT_UNAVAILABLE',
      };
    }
    if (task.taskType === CareTaskType.DOCTOR_REVIEW)
      return { kind: 'doctor_review', responseMode: 'assigned_doctor' };
    return {
      kind: task.taskType,
      responseConfigured: false,
      reasonCode: 'CARE_TASK_RESPONSE_POLICY_NOT_CONFIGURED',
    };
  }

  private async allowedActions(actor: CareActor, task: PlainTask, now: Date) {
    if (
      ![CareTaskStatus.SCHEDULED, CareTaskStatus.DUE].includes(task.status) ||
      now < new Date(task.windowStart) ||
      now > new Date(task.windowEnd)
    )
      return [];
    if (
      actor.role === UserRole.DOCTOR &&
      task.taskType === CareTaskType.DOCTOR_REVIEW
    )
      return ['doctor_review'];
    if (actor.role !== UserRole.PATIENT) return [];
    if (task.taskType === CareTaskType.METRIC) return ['record_metric'];
    if (
      task.taskType === CareTaskType.CHECK_IN &&
      checkInAllowedSymptoms(task.completionRule)
    )
      return ['submit_check_in'];
    if (
      task.taskType === CareTaskType.EDUCATION &&
      task.completionRule?.responseMode === 'acknowledge' &&
      task.contentRef &&
      this.contentCatalog &&
      (await this.contentCatalog.resolvePublished(task.contentRef))
    )
      return [CareTaskResponseAction.ACKNOWLEDGE];
    return [];
  }

  private hash(value: unknown) {
    return createHash('sha256').update(this.stable(value)).digest('hex');
  }

  private stable(value: unknown): string {
    if (Array.isArray(value))
      return `[${value.map((item) => this.stable(item)).join(',')}]`;
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${this.stable(record[key])}`)
        .join(',')}}`;
    }
    return JSON.stringify(value) ?? 'undefined';
  }

  private objectId(value: string, code: string) {
    if (!Types.ObjectId.isValid(value))
      this.notFound(code, code.replaceAll('_', ' ').toLowerCase());
    return new Types.ObjectId(value);
  }

  private iso(value: unknown) {
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

  private notFound(code: string, message: string): never {
    this.fail(code, HttpStatus.NOT_FOUND, message);
  }

  private fail(code: string, status: HttpStatus, message: string): never {
    throw new HttpException({ code, message }, status);
  }
}
