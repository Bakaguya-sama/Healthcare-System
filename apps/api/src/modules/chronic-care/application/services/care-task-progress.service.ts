import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import type { PageResult } from '../../../../common/pagination';
import { UserRole } from '../../../../core/domain/user.enums';
import { AuditLog } from '../../../platform-audit/public-api';
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
} from '../../presentation/dto/care-task.dto';
import { DOCTOR_REPOSITORY_PORT } from '../ports/doctor.repository.port';
import type { DoctorRepositoryPort } from '../ports/doctor.repository.port';
import { PATIENT_REPOSITORY_PORT } from '../ports/patient.repository.port';
import type { PatientRepositoryPort } from '../ports/patient.repository.port';
import type { CareActor } from './care-program-rule.service';

type PlainTask = Record<string, unknown> & {
  _id: Types.ObjectId;
  patientCareProgramId: Types.ObjectId;
  patientId: Types.ObjectId;
  taskType: CareTaskType;
  status: CareTaskStatus;
  templateKey: string;
  required: boolean;
  scheduledFor: Date;
  windowStart: Date;
  windowEnd: Date;
  completionRule: Record<string, unknown>;
  completionSourceId?: Types.ObjectId;
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
    return {
      items: rows.map((row) =>
        this.summary(actor, row as unknown as PlainTask, new Date()),
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
      { $match: { patientCareProgramId: enrollment._id, required: true } },
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
        this.assertResponsePolicy(task, input);
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
                response: {
                  kind: 'education_acknowledgement',
                  action: CareTaskResponseAction.ACKNOWLEDGE,
                  acknowledgedAt: now,
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
      });
    } finally {
      await session.endSession();
    }
    return {
      task: this.detailProjection(actor, result, now),
      replayed,
    };
  }

  private assertResponsePolicy(
    task: PlainTask,
    input: SubmitCareTaskResponseDto,
  ) {
    if (task.taskType === CareTaskType.METRIC)
      this.fail(
        'CARE_TASK_RESPONSE_USE_HEALTH_METRIC',
        HttpStatus.CONFLICT,
        'Metric tasks must be completed through Health Tracking (HLTH-02)',
      );
    if (
      task.taskType !== CareTaskType.EDUCATION ||
      task.completionRule?.responseMode !== 'acknowledge'
    )
      this.fail(
        'CARE_TASK_RESPONSE_POLICY_NOT_CONFIGURED',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'No approved response policy is configured for this task',
      );
    if (input.action !== CareTaskResponseAction.ACKNOWLEDGE)
      this.fail(
        'CARE_TASK_RESPONSE_INVALID',
        HttpStatus.BAD_REQUEST,
        'Unsupported response action',
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

  private summary(actor: CareActor, task: PlainTask, now: Date) {
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
      allowedActions: this.allowedActions(actor, task, now),
    };
  }

  private detailProjection(actor: CareActor, task: PlainTask, now: Date) {
    const detail: Record<string, unknown> = {
      ...this.summary(actor, task, now),
      presentation: this.presentation(task),
      progress: {
        status: task.status,
        completedAt: this.iso(task.completedAt),
        completionSource:
          task.completionSourceType === 'patientResponse'
            ? 'patient_response'
            : task.completionSourceType === 'healthMetric'
              ? 'health_metric'
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

  private presentation(task: PlainTask): Record<string, unknown> {
    if (task.taskType === CareTaskType.METRIC)
      return {
        kind: 'metric',
        metricType: task.completionRule?.metricType,
        responseEndpoint: 'HLTH-02',
      };
    if (
      task.taskType === CareTaskType.EDUCATION &&
      task.completionRule?.responseMode === 'acknowledge'
    )
      return { kind: 'education', responseMode: 'acknowledge' };
    return {
      kind: task.taskType,
      responseConfigured: false,
      reasonCode: 'CARE_TASK_RESPONSE_POLICY_NOT_CONFIGURED',
    };
  }

  private allowedActions(actor: CareActor, task: PlainTask, now: Date) {
    if (
      actor.role !== UserRole.PATIENT ||
      ![CareTaskStatus.SCHEDULED, CareTaskStatus.DUE].includes(task.status) ||
      now < new Date(task.windowStart) ||
      now > new Date(task.windowEnd)
    )
      return [];
    if (task.taskType === CareTaskType.METRIC) return ['record_metric'];
    if (
      task.taskType === CareTaskType.EDUCATION &&
      task.completionRule?.responseMode === 'acknowledge'
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
