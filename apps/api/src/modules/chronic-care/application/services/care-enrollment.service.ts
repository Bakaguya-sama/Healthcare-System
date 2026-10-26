import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { UserRole } from '../../../../core/domain/user.enums';
import { AuditLog } from '../../../platform-audit/public-api';
import {
  CareCommandIdempotency,
  CareCommandIdempotencyDocument,
} from '../../domain/entities/care-command-idempotency.entity';
import {
  CareProgram,
  CareProgramDocument,
  CareProgramStatus,
} from '../../domain/entities/care-program.entity';
import {
  CareRule,
  CareRuleDocument,
  CareRuleStatus,
} from '../../domain/entities/care-rule.entity';
import {
  PatientCareProgram,
  PatientCareProgramDocument,
  PatientCareProgramStatus,
} from '../../domain/entities/patient-care-program.entity';
import { CARE_PROGRAM_ACCESS_PORT } from '../ports/care-program-access.port';
import type { CareProgramAccessPort } from '../ports/care-program-access.port';
import { DOCTOR_REPOSITORY_PORT } from '../ports/doctor.repository.port';
import type { DoctorRepositoryPort } from '../ports/doctor.repository.port';
import { PATIENT_REPOSITORY_PORT } from '../ports/patient.repository.port';
import type { PatientRepositoryPort } from '../ports/patient.repository.port';
import type { CareActor } from './care-program-rule.service';
import {
  BASELINE_SCHEMA_VERSION_V1,
  validateBaselineAnswers,
} from '../validators/baseline-form.validator';

@Injectable()
export class CareEnrollmentService {
  constructor(
    @InjectModel(PatientCareProgram.name)
    private readonly enrollments: Model<PatientCareProgramDocument>,
    @InjectModel(CareProgram.name)
    private readonly programs: Model<CareProgramDocument>,
    @InjectModel(CareRule.name) private readonly rules: Model<CareRuleDocument>,
    @InjectModel(AuditLog.name) private readonly audits: Model<AuditLog>,
    @InjectModel(CareCommandIdempotency.name)
    private readonly idempotency: Model<CareCommandIdempotencyDocument>,
    @InjectConnection() private readonly connection: Connection,
    @Inject(DOCTOR_REPOSITORY_PORT)
    private readonly doctors: DoctorRepositoryPort,
    @Inject(PATIENT_REPOSITORY_PORT)
    private readonly patients: PatientRepositoryPort,
    @Inject(CARE_PROGRAM_ACCESS_PORT)
    private readonly programAccess: CareProgramAccessPort,
  ) {}

  private fail(
    code: string,
    status: HttpStatus,
    message: string,
    details?: Record<string, unknown>,
  ): never {
    throw new HttpException({ code, message, details }, status);
  }

  private id(value: string, code: string) {
    if (!Types.ObjectId.isValid(value))
      this.fail(code, HttpStatus.NOT_FOUND, 'Enrollment not found');
    return new Types.ObjectId(value);
  }

  private hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private admittedStatuses() {
    return [
      PatientCareProgramStatus.PENDING,
      PatientCareProgramStatus.ACTIVE,
      PatientCareProgramStatus.PAUSED,
    ];
  }

  private async checkProgramAccess(
    patientId: Types.ObjectId,
    programCode: string,
    session: any,
    excludingEnrollmentId?: Types.ObjectId,
  ) {
    const filter: Record<string, unknown> = {
      patientId,
      status: { $in: this.admittedStatuses() },
    };
    if (excludingEnrollmentId) filter._id = { $ne: excludingEnrollmentId };
    const activeProgramCount = await this.enrollments
      .countDocuments(filter)
      .session(session)
      .exec();
    return this.programAccess.check({
      patientId: String(patientId),
      programCode,
      activeProgramCount,
    });
  }

  private async reserveProgramAccessSlot(
    patientId: Types.ObjectId,
    limit: number,
    session: any,
    excludingEnrollmentId?: Types.ObjectId,
  ) {
    const filter: Record<string, unknown> = {
      patientId,
      status: { $in: this.admittedStatuses() },
      programAccessSlot: { $exists: true },
    };
    if (excludingEnrollmentId) filter._id = { $ne: excludingEnrollmentId };
    const enrolled = await this.enrollments
      .find(filter)
      .select('programAccessSlot')
      .session(session)
      .lean()
      .exec();
    const occupied = new Set(
      enrolled.flatMap((enrollment) =>
        Number.isInteger(enrollment.programAccessSlot)
          ? [enrollment.programAccessSlot]
          : [],
      ),
    );
    for (let slot = 0; slot < limit; slot += 1)
      if (!occupied.has(slot)) return slot;
    return null;
  }

  private async reserveAccessForEnrollment(
    enrollment: PatientCareProgramDocument,
    session: any,
  ): Promise<string | undefined> {
    const programCode = (enrollment.programConfig as Record<string, unknown>)
      .programCode;
    if (typeof programCode !== 'string' || !programCode)
      return 'program_snapshot_invalid';
    const entitlement = await this.checkProgramAccess(
      enrollment.patientId,
      programCode,
      session,
      enrollment._id,
    );
    if (!entitlement.eligible) return entitlement.reasonCode;
    if (
      Number.isInteger(enrollment.programAccessSlot) &&
      enrollment.programAccessSlot! < entitlement.activeCareProgramLimit
    )
      return undefined;
    const slot = await this.reserveProgramAccessSlot(
      enrollment.patientId,
      entitlement.activeCareProgramLimit,
      session,
      enrollment._id,
    );
    if (slot === null) return 'active_care_program_limit_reached';
    enrollment.programAccessSlot = slot;
    return undefined;
  }

  private async audit(
    e: PatientCareProgramDocument,
    actor: CareActor,
    action: string,
    reason: string | undefined,
    from: string | undefined,
    session: any,
  ) {
    await this.audits.create(
      [
        {
          domain: 'care',
          entityType: 'careEnrollment',
          entityId: e._id,
          actorId: this.id(actor.id, 'CARE_FORBIDDEN'),
          action,
          reason,
          fromStatus: from,
          toStatus: e.status,
          metadata: { revision: e.revision },
        },
      ],
      { session },
    );
  }

  private async command(
    actor: CareActor,
    operation: string,
    key: string,
    payload: unknown,
    work: (s: any) => Promise<PatientCareProgramDocument>,
  ) {
    if (!key?.trim())
      this.fail(
        'CARE_IDEMPOTENCY_KEY_REQUIRED',
        HttpStatus.BAD_REQUEST,
        'Idempotency-Key is required',
      );
    const actorId = this.id(actor.id, 'CARE_FORBIDDEN'),
      requestHash = this.hash(payload),
      session = await this.connection.startSession();
    let result!: PatientCareProgramDocument;
    try {
      await session.withTransaction(async () => {
        const old = await this.idempotency
          .findOne({ actorId, operation, key })
          .session(session)
          .exec();
        if (old) {
          if (old.requestHash !== requestHash)
            this.fail(
              'CARE_IDEMPOTENCY_CONFLICT',
              HttpStatus.CONFLICT,
              'Idempotency key was reused with a different request',
            );
          const replay = await this.enrollments
            .findById(old.entityId)
            .session(session)
            .exec();
          if (!replay)
            this.fail(
              'CARE_IDEMPOTENCY_CONFLICT',
              HttpStatus.CONFLICT,
              'Original command result is unavailable',
            );
          result = replay;
          return;
        }
        result = await work(session);
        await this.idempotency.create(
          [
            {
              actorId,
              operation,
              key,
              requestHash,
              entityType: 'careEnrollment',
              entityId: result._id,
            },
          ],
          { session },
        );
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  private async guard(
    e: PatientCareProgramDocument,
    session: any,
  ): Promise<string[]> {
    const p = await this.programs.findById(e.careProgramId).exec(),
      r = await this.rules.findById(e.careRuleId).exec();
    const reasons: string[] = [];
    if (!(await this.patients.isActive(String(e.patientId))))
      reasons.push('patient_not_active');
    if (!(await this.doctors.isActiveAndApproved(String(e.doctorId))))
      reasons.push('doctor_not_approved');
    if (!p || p.status !== CareProgramStatus.PUBLISHED)
      reasons.push('program_not_published');
    if (!r || r.status !== CareRuleStatus.ACTIVE)
      reasons.push('rule_not_active');
    const consent = e.consent as any;
    if (
      !consent?.acceptedAt ||
      !consent?.policyVersion ||
      consent.policyVersion !== (e.programConfig as any).consentPolicyVersion
    )
      reasons.push('consent_incomplete');
    const baseline = validateBaselineAnswers(
      (e.programConfig as any).baselineForm,
      e.baselineAnswers ?? {},
    );
    if (!baseline.valid) reasons.push('baseline_incomplete');
    if (!reasons.length) {
      const accessReason = await this.reserveAccessForEnrollment(e, session);
      if (accessReason) reasons.push(accessReason);
    }
    return reasons;
  }

  async create(actor: CareActor, input: any, key: string) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.createOnce(actor, input, key);
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        if (attempt === 1)
          this.fail(
            'CARE_PROGRAM_ACCESS_DENIED',
            HttpStatus.CONFLICT,
            'Patient is not eligible for another care program',
            { reasons: ['active_care_program_limit_reached'] },
          );
      }
    }
    this.fail(
      'CARE_PROGRAM_ACCESS_DENIED',
      HttpStatus.CONFLICT,
      'Patient is not eligible for another care program',
      { reasons: ['active_care_program_limit_reached'] },
    );
  }

  private async createOnce(actor: CareActor, input: any, key: string) {
    if (
      actor.role !== UserRole.DOCTOR ||
      !(await this.doctors.isActiveAndApproved(actor.id))
    )
      this.fail(
        'CARE_DOCTOR_NOT_APPROVED',
        HttpStatus.CONFLICT,
        'Doctor is not active and approved',
      );
    return this.command(
      actor,
      'care-enrollment.create',
      key,
      input,
      async (s) => {
        if (!(await this.patients.isActive(input.patientId)))
          this.fail(
            'CARE_PATIENT_NOT_ACTIVE',
            HttpStatus.CONFLICT,
            'Patient is not active',
          );
        const p = await this.programs
          .findById(this.id(input.programId, 'CARE_PROGRAM_NOT_FOUND'))
          .session(s)
          .exec();
        if (!p)
          this.fail(
            'CARE_PROGRAM_NOT_FOUND',
            HttpStatus.NOT_FOUND,
            'Program not found',
          );
        if (p.status !== CareProgramStatus.PUBLISHED)
          this.fail(
            'CARE_PROGRAM_NOT_PUBLISHED',
            HttpStatus.CONFLICT,
            'Program is not published',
          );
        const r = await this.rules
          .findOne({ careProgramId: p._id, status: CareRuleStatus.ACTIVE })
          .session(s)
          .exec();
        if (!r)
          this.fail(
            'CARE_RULE_NOT_ACTIVE',
            HttpStatus.CONFLICT,
            'Program has no active rule',
          );
        const allowed = new Set(p.doctorEditableFields);
        if (
          Object.keys(input.customSettings ?? {}).some((x) => !allowed.has(x))
        )
          this.fail(
            'CARE_DOCTOR_OVERRIDE_FORBIDDEN',
            HttpStatus.FORBIDDEN,
            'Custom setting is not allowed',
          );
        const programCode = p.programCode;
        const entitlement = await this.checkProgramAccess(
          this.id(input.patientId, 'CARE_PATIENT_NOT_ACTIVE'),
          programCode,
          s,
        );
        if (!entitlement.eligible)
          this.fail(
            'CARE_PROGRAM_ACCESS_DENIED',
            HttpStatus.CONFLICT,
            'Patient is not eligible for another care program',
            { reasons: [entitlement.reasonCode] },
          );
        const patientId = this.id(input.patientId, 'CARE_PATIENT_NOT_ACTIVE');
        const accessSlot = await this.reserveProgramAccessSlot(
          patientId,
          entitlement.activeCareProgramLimit,
          s,
        );
        if (accessSlot === null)
          this.fail(
            'CARE_PROGRAM_ACCESS_DENIED',
            HttpStatus.CONFLICT,
            'Patient is not eligible for another care program',
            { reasons: ['active_care_program_limit_reached'] },
          );
        const e = new this.enrollments({
          patientId,
          doctorId: this.id(actor.id, 'CARE_FORBIDDEN'),
          careProgramId: p._id,
          careRuleId: r._id,
          programAccessSlot: accessSlot,
          timezone: input.timezone,
          customSettings: input.customSettings,
          revision: 1,
          consent: {},
          programConfig: {
            programCode,
            programVersion: p.version,
            baselineSchemaVersion:
              (p.baselineForm as any)?.schemaVersion ??
              BASELINE_SCHEMA_VERSION_V1,
            consentPolicyVersion:
              (p.reviewPolicy as any)?.consentPolicyVersion ?? 'v1',
            baselineForm: p.baselineForm,
            ruleSnapshot: {
              careRuleId: String(r._id),
              version: r.version,
              revision: r.revision,
              rules: r.rules,
            },
            taskTemplates: p.taskTemplates,
            reminderPolicy: p.reminderPolicy,
            doctorEditableFields: p.doctorEditableFields,
          },
          createdBy: this.id(actor.id, 'CARE_FORBIDDEN'),
        });
        await e.save({ session: s });
        await this.audit(
          e,
          actor,
          'care_enrollment_created',
          'care_program_access_granted',
          undefined,
          s,
        );
        return e;
      },
    );
  }

  async submitConsent(actor: CareActor, id: string, dto: any, key: string) {
    return this.command(
      actor,
      'care-enrollment.consent',
      key,
      { id, dto },
      async (s) => {
        const e = await this.enrollments
          .findOne({
            _id: this.id(id, 'CARE_ENROLLMENT_NOT_FOUND'),
            patientId: this.id(actor.id, 'CARE_FORBIDDEN'),
            status: PatientCareProgramStatus.PENDING,
          })
          .session(s)
          .exec();
        if (!e)
          this.fail(
            'CARE_ENROLLMENT_NOT_FOUND',
            HttpStatus.NOT_FOUND,
            'Enrollment not found',
          );
        if (dto.policyVersion !== (e.programConfig as any).consentPolicyVersion)
          this.fail(
            'CARE_CONSENT_VERSION_MISMATCH',
            HttpStatus.CONFLICT,
            'Consent policy version does not match',
          );
        e.consent = { ...dto, acceptedAt: new Date() };
        e.revision++;
        const reasons = await this.guard(e, s);
        if (!reasons.length) {
          e.status = PatientCareProgramStatus.ACTIVE;
          e.startedAt = new Date();
        }
        await e.save({ session: s });
        await this.audit(
          e,
          actor,
          'care_consent_submitted',
          undefined,
          'pending',
          s,
        );
        return e;
      },
    );
  }

  async submitBaseline(actor: CareActor, id: string, dto: any, key: string) {
    return this.command(
      actor,
      'care-enrollment.baseline',
      key,
      { id, dto },
      async (s) => {
        const e = await this.enrollments
          .findOne({
            _id: this.id(id, 'CARE_ENROLLMENT_NOT_FOUND'),
            patientId: this.id(actor.id, 'CARE_FORBIDDEN'),
            status: PatientCareProgramStatus.PENDING,
          })
          .session(s)
          .exec();
        if (!e)
          this.fail(
            'CARE_ENROLLMENT_NOT_FOUND',
            HttpStatus.NOT_FOUND,
            'Enrollment not found',
          );
        const result = validateBaselineAnswers(
          (e.programConfig as any).baselineForm,
          dto.answers,
        );
        if (!result.valid)
          this.fail(
            'CARE_BASELINE_INCOMPLETE',
            HttpStatus.UNPROCESSABLE_ENTITY,
            'Baseline answers do not match the enrollment schema',
            {
              fields: result.issues.map((issue) => issue.field).filter(Boolean),
              reasons: result.issues.map((issue) => issue.code),
            },
          );
        e.baselineAnswers = dto.answers;
        e.baselineCompletedAt = new Date();
        e.revision++;
        const reasons = await this.guard(e, s);
        if (!reasons.length) {
          e.status = PatientCareProgramStatus.ACTIVE;
          e.startedAt = new Date();
        }
        await e.save({ session: s });
        await this.audit(
          e,
          actor,
          'care_baseline_submitted',
          undefined,
          'pending',
          s,
        );
        return e;
      },
    );
  }

  async withdrawConsent(actor: CareActor, id: string, key: string) {
    return this.command(
      actor,
      'care-enrollment.withdraw-consent',
      key,
      { id },
      async (s) => {
        const e = await this.enrollments
          .findOne({
            _id: this.id(id, 'CARE_ENROLLMENT_NOT_FOUND'),
            patientId: this.id(actor.id, 'CARE_FORBIDDEN'),
            status: { $in: ['pending', 'active', 'paused'] },
          })
          .session(s)
          .exec();
        if (!e)
          this.fail(
            'CARE_ENROLLMENT_INVALID_STATE',
            HttpStatus.CONFLICT,
            'Enrollment cannot be cancelled',
          );
        const from = e.status;
        e.status = PatientCareProgramStatus.CANCELLED;
        e.cancelledAt = new Date();
        e.cancelledBy = this.id(actor.id, 'CARE_FORBIDDEN');
        e.cancellationReason = 'consent_withdrawn';
        e.revision++;
        await e.save({ session: s });
        await this.audit(
          e,
          actor,
          'care_consent_withdrawn',
          'consent_withdrawn',
          from,
          s,
        );
        return e;
      },
    );
  }

  async transition(
    actor: CareActor,
    id: string,
    action: 'pause' | 'resume' | 'complete' | 'cancel',
    dto: any,
    key: string,
  ) {
    return this.command(
      actor,
      `care-enrollment.${action}`,
      key,
      { id, dto },
      async (s) => {
        const e = await this.enrollments
          .findById(this.id(id, 'CARE_ENROLLMENT_NOT_FOUND'))
          .session(s)
          .exec();
        if (!e || String(e.doctorId) !== actor.id)
          this.fail(
            'CARE_FORBIDDEN',
            HttpStatus.FORBIDDEN,
            'Only assigned Doctor may transition enrollment',
          );
        if (e.revision !== dto.expectedRevision)
          this.fail(
            'CARE_ENROLLMENT_INVALID_STATE',
            HttpStatus.CONFLICT,
            'Enrollment revision is stale',
          );
        const from = e.status;
        if (action === 'pause' && from === PatientCareProgramStatus.ACTIVE) {
          e.status = PatientCareProgramStatus.PAUSED;
          e.pausedAt = new Date();
          e.pausedBy = this.id(actor.id, 'CARE_FORBIDDEN');
          e.pauseReason = dto.reason;
        } else if (
          action === 'resume' &&
          from === PatientCareProgramStatus.PAUSED
        ) {
          const reasons = await this.guard(e, s);
          if (reasons.length)
            this.fail(
              'CARE_ENROLLMENT_ACTIVATION_BLOCKED',
              HttpStatus.CONFLICT,
              'Enrollment activation is blocked',
              { reasons },
            );
          e.status = PatientCareProgramStatus.ACTIVE;
          e.resumedAt = new Date();
          e.resumedBy = this.id(actor.id, 'CARE_FORBIDDEN');
        } else if (
          action === 'complete' &&
          (from === 'active' || from === 'paused')
        ) {
          e.status = PatientCareProgramStatus.COMPLETED;
          e.completedAt = new Date();
          e.completedBy = this.id(actor.id, 'CARE_FORBIDDEN');
          e.completionReason = dto.reason;
        } else if (
          action === 'cancel' &&
          (from === 'pending' || from === 'active' || from === 'paused')
        ) {
          e.status = PatientCareProgramStatus.CANCELLED;
          e.cancelledAt = new Date();
          e.cancelledBy = this.id(actor.id, 'CARE_FORBIDDEN');
          e.cancellationReason = dto.reason;
        } else
          this.fail(
            'CARE_ENROLLMENT_INVALID_STATE',
            HttpStatus.CONFLICT,
            'Invalid enrollment state transition',
          );
        e.revision++;
        await e.save({ session: s });
        await this.audit(
          e,
          actor,
          `care_enrollment_${action}`,
          dto.reason,
          from,
          s,
        );
        return e;
      },
    );
  }
}
