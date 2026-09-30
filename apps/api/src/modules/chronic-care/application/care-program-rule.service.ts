import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { UserRole } from '../../../core/domain/user.enums';
import { AuditLog } from '../../platform-audit/public-api';
import {
  CareCommandIdempotency,
  CareCommandIdempotencyDocument,
} from '../entities/care-command-idempotency.entity';
import {
  CareProgram,
  CareProgramDocument,
  CareProgramStatus,
} from '../entities/care-program.entity';
import {
  CareRule,
  CareRuleDocument,
  CareRuleStatus,
} from '../entities/care-rule.entity';
import { DOCTOR_REPOSITORY_PORT } from './ports/doctor.repository.port';
import type { DoctorRepositoryPort } from './ports/doctor.repository.port';
import { validateBaselineForm } from './baseline-form.validator';

export type CareActor = { id: string; role: UserRole };
type Entity = CareProgramDocument | CareRuleDocument;
type EntityType = 'careProgram' | 'careRule';

@Injectable()
export class CareProgramRuleService {
  constructor(
    @InjectModel(CareProgram.name)
    private readonly programs: Model<CareProgramDocument>,
    @InjectModel(CareRule.name) private readonly rules: Model<CareRuleDocument>,
    @InjectModel(AuditLog.name) private readonly auditLogs: Model<AuditLog>,
    @InjectModel(CareCommandIdempotency.name)
    private readonly idempotency: Model<CareCommandIdempotencyDocument>,
    @InjectConnection() private readonly connection: Connection,
    @Inject(DOCTOR_REPOSITORY_PORT)
    private readonly doctors: DoctorRepositoryPort,
  ) {}

  private fail(
    code: string,
    status: HttpStatus,
    message: string,
    details?: Record<string, unknown>,
  ): never {
    throw new HttpException({ code, message, details }, status);
  }

  private objectId(id: string, code: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id))
      this.fail(code, HttpStatus.NOT_FOUND, 'Resource not found');
    return new Types.ObjectId(id);
  }

  private requireAdmin(actor: CareActor): void {
    if (actor.role !== UserRole.ADMIN)
      this.fail(
        'CARE_FORBIDDEN',
        HttpStatus.FORBIDDEN,
        'Care catalog action is forbidden',
      );
  }

  private requireValidBaselineForm(value: unknown): void {
    const result = validateBaselineForm(value);
    if (!result.valid)
      this.fail(
        'CARE_BASELINE_SCHEMA_INVALID',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Baseline schema must be a supported allowlisted schema',
        { reasons: result.issues.map((issue) => issue.code) },
      );
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
    return JSON.stringify(value);
  }

  private async writeAudit(
    entity: Entity,
    entityType: EntityType,
    actor: CareActor,
    action: string,
    options: {
      fromStatus?: string;
      toStatus?: string;
      reason?: string;
      changedFields?: string[];
    } = {},
    session?: any,
  ): Promise<void> {
    await this.auditLogs.create(
      [
        {
          domain: 'care',
          entityType,
          entityId: entity._id,
          actorId: this.objectId(actor.id, 'CARE_FORBIDDEN'),
          action,
          ...options,
          metadata: {
            version: entity.version,
            revision: entity.revision,
            changedFields: options.changedFields,
          },
        },
      ],
      session ? { session } : undefined,
    );
  }

  private async execute<T extends Entity>(
    actor: CareActor,
    operation: string,
    idempotencyKey: string,
    payload: unknown,
    entityType: EntityType,
    work: (session: any) => Promise<T>,
  ): Promise<T> {
    if (!idempotencyKey?.trim())
      this.fail(
        'CARE_IDEMPOTENCY_KEY_REQUIRED',
        HttpStatus.BAD_REQUEST,
        'Idempotency-Key is required',
      );
    const actorId = this.objectId(actor.id, 'CARE_FORBIDDEN');
    const requestHash = createHash('sha256')
      .update(this.stable(payload))
      .digest('hex');
    const session = await this.connection.startSession();
    let result!: T;
    try {
      await session.withTransaction(async () => {
        const existing = await this.idempotency
          .findOne({ actorId, operation, key: idempotencyKey })
          .session(session)
          .exec();
        if (existing) {
          if (existing.requestHash !== requestHash)
            this.fail(
              'CARE_IDEMPOTENCY_CONFLICT',
              HttpStatus.CONFLICT,
              'Idempotency key was reused with a different request',
            );
          const replay =
            existing.entityType === 'careProgram'
              ? await this.programs
                  .findById(existing.entityId)
                  .session(session)
                  .exec()
              : await this.rules
                  .findById(existing.entityId)
                  .session(session)
                  .exec();
          if (!replay)
            this.fail(
              'CARE_IDEMPOTENCY_CONFLICT',
              HttpStatus.CONFLICT,
              'Original command result is unavailable',
            );
          result = replay as T;
          return;
        }
        result = await work(session);
        await this.idempotency.create(
          [
            {
              actorId,
              operation,
              key: idempotencyKey,
              requestHash,
              entityType,
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

  async createProgram(
    actor: CareActor,
    input: Record<string, any>,
    key: string,
  ) {
    this.requireAdmin(actor);
    this.requireValidBaselineForm(input.baselineForm);
    return this.execute(
      actor,
      'care-program.create',
      key,
      input,
      'careProgram',
      async (session) => {
        const latest = await this.programs
          .findOne({ programCode: input.programCode })
          .sort({ version: -1 })
          .session(session)
          .exec();
        const program = new this.programs({
          ...input,
          version: (latest?.version ?? 0) + 1,
          revision: 1,
          status: CareProgramStatus.DRAFT,
          createdBy: this.objectId(actor.id, 'CARE_FORBIDDEN'),
        });
        await program.save({ session });
        await this.writeAudit(
          program,
          'careProgram',
          actor,
          'care_program_draft_created',
          { toStatus: CareProgramStatus.DRAFT },
          session,
        );
        return program;
      },
    );
  }

  async updateProgram(
    actor: CareActor,
    id: string,
    input: Record<string, any>,
    key: string,
  ) {
    this.requireAdmin(actor);
    const expectedRevision = input.expectedRevision as number;
    delete input.expectedRevision;
    if (input.baselineForm !== undefined)
      this.requireValidBaselineForm(input.baselineForm);
    return this.execute(
      actor,
      'care-program.update',
      key,
      { id, expectedRevision, input },
      'careProgram',
      async (session) => {
        const program = await this.programs
          .findOneAndUpdate(
            {
              _id: this.objectId(id, 'CARE_PROGRAM_NOT_FOUND'),
              status: CareProgramStatus.DRAFT,
              revision: expectedRevision,
            },
            { $set: input, $inc: { revision: 1 } },
            { new: true, session },
          )
          .exec();
        if (!program)
          this.fail(
            'CARE_RULE_VERSION_CONFLICT',
            HttpStatus.CONFLICT,
            'Program is not a current draft version',
          );
        await this.writeAudit(
          program,
          'careProgram',
          actor,
          'care_program_draft_updated',
          { changedFields: Object.keys(input) },
          session,
        );
        return program;
      },
    );
  }

  async publishProgram(
    actor: CareActor,
    id: string,
    expectedRevision: number,
    reason: string,
    key: string,
  ) {
    this.requireAdmin(actor);
    return this.execute(
      actor,
      'care-program.publish',
      key,
      { id, expectedRevision, reason },
      'careProgram',
      async (session) => {
        const draft = await this.programs
          .findOne({
            _id: this.objectId(id, 'CARE_PROGRAM_NOT_FOUND'),
            status: CareProgramStatus.DRAFT,
            revision: expectedRevision,
          })
          .session(session)
          .exec();
        if (!draft)
          this.fail(
            'CARE_RULE_VERSION_CONFLICT',
            HttpStatus.CONFLICT,
            'Program is not a current draft version',
          );
        this.requireValidBaselineForm(draft.baselineForm);
        const program = await this.programs
          .findOneAndUpdate(
            {
              _id: this.objectId(id, 'CARE_PROGRAM_NOT_FOUND'),
              status: CareProgramStatus.DRAFT,
              revision: expectedRevision,
            },
            {
              $set: {
                status: CareProgramStatus.PUBLISHED,
                publishedBy: this.objectId(actor.id, 'CARE_FORBIDDEN'),
                publishedAt: new Date(),
              },
              $inc: { revision: 1 },
            },
            { new: true, session },
          )
          .exec();
        if (!program)
          this.fail(
            'CARE_RULE_VERSION_CONFLICT',
            HttpStatus.CONFLICT,
            'Program is not a current draft version',
          );
        await this.writeAudit(
          program,
          'careProgram',
          actor,
          'care_program_published',
          {
            fromStatus: CareProgramStatus.DRAFT,
            toStatus: CareProgramStatus.PUBLISHED,
            reason,
          },
          session,
        );
        return program;
      },
    );
  }

  async retireProgram(
    actor: CareActor,
    id: string,
    expectedRevision: number,
    reason: string,
    key: string,
  ) {
    this.requireAdmin(actor);
    return this.execute(
      actor,
      'care-program.retire',
      key,
      { id, expectedRevision, reason },
      'careProgram',
      async (session) => {
        const program = await this.programs
          .findOneAndUpdate(
            {
              _id: this.objectId(id, 'CARE_PROGRAM_NOT_FOUND'),
              status: CareProgramStatus.PUBLISHED,
              revision: expectedRevision,
            },
            {
              $set: {
                status: CareProgramStatus.RETIRED,
                retiredBy: this.objectId(actor.id, 'CARE_FORBIDDEN'),
                retiredAt: new Date(),
              },
              $inc: { revision: 1 },
            },
            { new: true, session },
          )
          .exec();
        if (!program)
          this.fail(
            'CARE_RULE_VERSION_CONFLICT',
            HttpStatus.CONFLICT,
            'Program is not a current published version',
          );
        await this.writeAudit(
          program,
          'careProgram',
          actor,
          'care_program_retired',
          {
            fromStatus: CareProgramStatus.PUBLISHED,
            toStatus: CareProgramStatus.RETIRED,
            reason,
          },
          session,
        );
        return program;
      },
    );
  }

  async createRule(
    actor: CareActor,
    programId: string,
    input: Record<string, any>,
    key: string,
  ) {
    this.requireAdmin(actor);
    return this.execute(
      actor,
      'care-rule.create',
      key,
      { programId, input },
      'careRule',
      async (session) => {
        const careProgramId = this.objectId(
          programId,
          'CARE_PROGRAM_NOT_FOUND',
        );
        if (
          !(await this.programs.exists({ _id: careProgramId }).session(session))
        )
          this.fail(
            'CARE_PROGRAM_NOT_FOUND',
            HttpStatus.NOT_FOUND,
            'Program not found',
          );
        const latest = await this.rules
          .findOne({ careProgramId })
          .sort({ version: -1 })
          .session(session)
          .exec();
        const rule = new this.rules({
          ...input,
          careProgramId,
          version: (latest?.version ?? 0) + 1,
          revision: 1,
          status: CareRuleStatus.DRAFT,
          createdBy: this.objectId(actor.id, 'CARE_FORBIDDEN'),
        });
        await rule.save({ session });
        await this.writeAudit(
          rule,
          'careRule',
          actor,
          'care_rule_draft_created',
          { toStatus: CareRuleStatus.DRAFT },
          session,
        );
        return rule;
      },
    );
  }

  async updateRule(
    actor: CareActor,
    programId: string,
    ruleId: string,
    input: Record<string, any>,
    key: string,
  ) {
    this.requireAdmin(actor);
    const expectedRevision = input.expectedRevision as number;
    delete input.expectedRevision;
    return this.execute(
      actor,
      'care-rule.update',
      key,
      { programId, ruleId, expectedRevision, input },
      'careRule',
      async (session) => {
        const rule = await this.rules
          .findOneAndUpdate(
            {
              _id: this.objectId(ruleId, 'CARE_RULE_NOT_FOUND'),
              careProgramId: this.objectId(programId, 'CARE_PROGRAM_NOT_FOUND'),
              status: CareRuleStatus.DRAFT,
              revision: expectedRevision,
            },
            { $set: input, $inc: { revision: 1 } },
            { new: true, session },
          )
          .exec();
        if (!rule)
          this.fail(
            'CARE_RULE_VERSION_CONFLICT',
            HttpStatus.CONFLICT,
            'Rule is not a current draft version',
          );
        await this.writeAudit(
          rule,
          'careRule',
          actor,
          'care_rule_draft_updated',
          { changedFields: Object.keys(input) },
          session,
        );
        return rule;
      },
    );
  }

  private validateRules(rules: unknown): boolean {
    const allowed = new Set([
      'all',
      'any',
      'not',
      'gt',
      'gte',
      'lt',
      'lte',
      'between',
      'exists',
      'equal',
      'not_equal',
    ]);
    return (
      Array.isArray(rules) &&
      rules.every(
        (rule) =>
          Boolean(rule) &&
          typeof rule === 'object' &&
          typeof (rule as Record<string, unknown>).operator === 'string' &&
          allowed.has((rule as Record<string, string>).operator),
      )
    );
  }

  async activateRule(
    actor: CareActor,
    programId: string,
    ruleId: string,
    expectedRevision: number,
    reason: string,
    key: string,
  ) {
    if (
      actor.role === UserRole.DOCTOR &&
      !(await this.doctors.isActiveAndApproved(actor.id))
    )
      this.fail(
        'CARE_DOCTOR_NOT_APPROVED',
        HttpStatus.CONFLICT,
        'Doctor is not active and approved',
      );
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.DOCTOR)
      this.fail(
        'CARE_FORBIDDEN',
        HttpStatus.FORBIDDEN,
        'Care rule activation is forbidden',
      );
    return this.execute(
      actor,
      'care-rule.activate',
      key,
      { programId, ruleId, expectedRevision, reason },
      'careRule',
      async (session) => {
        const careProgramId = this.objectId(
          programId,
          'CARE_PROGRAM_NOT_FOUND',
        );
        const program = await this.programs
          .findById(careProgramId)
          .session(session)
          .exec();
        if (!program)
          this.fail(
            'CARE_PROGRAM_NOT_FOUND',
            HttpStatus.NOT_FOUND,
            'Program not found',
          );
        if (program.status !== CareProgramStatus.PUBLISHED)
          this.fail(
            'CARE_PROGRAM_NOT_PUBLISHED',
            HttpStatus.CONFLICT,
            'Program must be published before rule activation',
          );
        const candidate = await this.rules
          .findOne({
            _id: this.objectId(ruleId, 'CARE_RULE_NOT_FOUND'),
            careProgramId,
            status: CareRuleStatus.DRAFT,
            revision: expectedRevision,
          })
          .session(session)
          .exec();
        if (!candidate)
          this.fail(
            'CARE_RULE_VERSION_CONFLICT',
            HttpStatus.CONFLICT,
            'Rule is not a current draft version',
          );
        if (!this.validateRules(candidate.rules))
          this.fail(
            'CARE_RULE_VALIDATION_FAILED',
            HttpStatus.UNPROCESSABLE_ENTITY,
            'Rule contains a disallowed declarative operator',
          );
        const previous = await this.rules
          .findOneAndUpdate(
            { careProgramId, status: CareRuleStatus.ACTIVE },
            {
              $set: {
                status: CareRuleStatus.RETIRED,
                retiredBy: this.objectId(actor.id, 'CARE_FORBIDDEN'),
                retiredAt: new Date(),
              },
              $inc: { revision: 1 },
            },
            { new: true, session },
          )
          .exec();
        candidate.status = CareRuleStatus.ACTIVE;
        candidate.activatedBy = this.objectId(actor.id, 'CARE_FORBIDDEN');
        candidate.activatedAt = new Date();
        candidate.revision += 1;
        await candidate.save({ session });
        if (previous)
          await this.writeAudit(
            previous,
            'careRule',
            actor,
            'care_rule_retired_by_activation',
            {
              fromStatus: CareRuleStatus.ACTIVE,
              toStatus: CareRuleStatus.RETIRED,
              reason,
            },
            session,
          );
        await this.writeAudit(
          candidate,
          'careRule',
          actor,
          'care_rule_activated',
          {
            fromStatus: CareRuleStatus.DRAFT,
            toStatus: CareRuleStatus.ACTIVE,
            reason,
          },
          session,
        );
        return candidate;
      },
    );
  }

  async retireRule(
    actor: CareActor,
    programId: string,
    ruleId: string,
    expectedRevision: number,
    reason: string,
    key: string,
  ) {
    this.requireAdmin(actor);
    return this.execute(
      actor,
      'care-rule.retire',
      key,
      { programId, ruleId, expectedRevision, reason },
      'careRule',
      async (session) => {
        const rule = await this.rules
          .findOneAndUpdate(
            {
              _id: this.objectId(ruleId, 'CARE_RULE_NOT_FOUND'),
              careProgramId: this.objectId(programId, 'CARE_PROGRAM_NOT_FOUND'),
              status: CareRuleStatus.ACTIVE,
              revision: expectedRevision,
            },
            {
              $set: {
                status: CareRuleStatus.RETIRED,
                retiredBy: this.objectId(actor.id, 'CARE_FORBIDDEN'),
                retiredAt: new Date(),
              },
              $inc: { revision: 1 },
            },
            { new: true, session },
          )
          .exec();
        if (!rule)
          this.fail(
            'CARE_RULE_VERSION_CONFLICT',
            HttpStatus.CONFLICT,
            'Rule is not a current active version',
          );
        await this.writeAudit(
          rule,
          'careRule',
          actor,
          'care_rule_retired',
          {
            fromStatus: CareRuleStatus.ACTIVE,
            toStatus: CareRuleStatus.RETIRED,
            reason,
          },
          session,
        );
        return rule;
      },
    );
  }
}
