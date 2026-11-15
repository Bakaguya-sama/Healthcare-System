import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '../../../../core/domain/user.enums';
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
import type { CareRuleNode } from '../../domain/rules/care-rule-interpreter';
import { validateCareRuleDataSources } from '../../domain/rules/care-rule-data-source.validator';
import {
  HEALTH_CHECK_IN_SCHEMA_VERSION,
  validateCareTaskTemplates,
} from '../../domain/tasks/care-task-template.validator';
import type {
  AdminCareRuleProjectionDto,
  CareRuleScenarioResultDto,
  CareRuleTestSummaryDto,
  DoctorCareRuleProjectionDto,
  SanitizedDeclarativeRuleDto,
  SanitizedRuleDataSourceDto,
} from '../../presentation/dto/care-rule-read.dto';
import { CareRuleReadView } from '../../presentation/dto/care-rule-read.dto';
import {
  DOCTOR_REPOSITORY_PORT,
  type DoctorRepositoryPort,
} from '../ports/doctor.repository.port';
import type { CareActor } from './care-program-rule.service';

type PlainRecord = Record<string, unknown> & { _id: Types.ObjectId };
type TestProjection = {
  testSummary?: CareRuleTestSummaryDto;
  testResults?: CareRuleScenarioResultDto[];
};

const GROUP_OPERATORS = new Set(['all', 'any', 'not']);
const NUMERIC_OPERATORS = new Set(['gt', 'gte', 'lt', 'lte']);
const VALUE_OPERATORS = new Set(['equal', 'not_equal']);
const ALL_OPERATORS = new Set([
  ...GROUP_OPERATORS,
  ...NUMERIC_OPERATORS,
  ...VALUE_OPERATORS,
  'between',
  'exists',
]);
const SEVERITIES = new Set(['normal', 'attention', 'urgent']);
const RULE_SEVERITIES = new Set(['attention', 'urgent']);
const TEST_STATUSES = new Set(['passed', 'failed', 'unavailable']);
const FACT_PREFIXES = new Set([
  'check_in.overall_status',
  'check_in.severity',
  'check_in.severity_rank',
  'check_in.symptom.',
]);
const SAFE_CODE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const SAFE_KEY = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/;
const TEMPLATE_KEY = /^[a-z][a-z0-9_]{0,63}$/;
const MAX_RULE_NODES = 200;
const MAX_RULE_DEPTH = 12;
const MAX_DATA_SOURCES = 50;
const MAX_SCENARIOS = 50;
const MAX_REASON_CODES = 32;

@Injectable()
export class CareRuleReadService {
  constructor(
    @InjectModel(CareProgram.name)
    private readonly programs: Model<CareProgramDocument>,
    @InjectModel(CareRule.name)
    private readonly rules: Model<CareRuleDocument>,
    @Inject(DOCTOR_REPOSITORY_PORT)
    private readonly doctors: DoctorRepositoryPort,
  ) {}

  async getCurrentRule(
    actor: CareActor,
    programId: string,
    view: CareRuleReadView,
  ): Promise<DoctorCareRuleProjectionDto | AdminCareRuleProjectionDto> {
    if (actor.role === UserRole.DOCTOR) {
      if (!(await this.doctors.isActiveAndApproved(actor.id))) this.forbidden();
      if (view === CareRuleReadView.DRAFT) this.forbidden();
    } else if (actor.role !== UserRole.ADMIN) {
      this.forbidden();
    }

    const careProgramId = this.objectId(programId);
    const programRow = await this.programs
      .findById(careProgramId)
      .lean()
      .exec();
    if (!programRow) this.ruleNotFound();
    const program = programRow as unknown as PlainRecord;
    const programStatus = program.status as CareProgramStatus;
    if (!Object.values(CareProgramStatus).includes(programStatus))
      this.projectionUnavailable('Program status is invalid');

    if (actor.role === UserRole.DOCTOR) {
      if (programStatus !== CareProgramStatus.PUBLISHED) this.ruleNotFound();
    } else if (
      (programStatus === CareProgramStatus.DRAFT &&
        view !== CareRuleReadView.DRAFT) ||
      (programStatus === CareProgramStatus.RETIRED &&
        view === CareRuleReadView.DRAFT)
    ) {
      this.ruleNotFound();
    }

    const status =
      view === CareRuleReadView.DRAFT
        ? CareRuleStatus.DRAFT
        : CareRuleStatus.ACTIVE;
    const query = this.rules.findOne({ careProgramId, status });
    if (status === CareRuleStatus.DRAFT) query.sort({ version: -1, _id: -1 });
    const ruleRow = await query.lean().exec();
    if (!ruleRow) this.ruleNotFound();
    const rule = ruleRow as unknown as PlainRecord;

    const sanitizedRules = this.sanitizeRules(rule.rules);
    const sanitizedSources = this.sanitizeDataSources(rule.dataSources);
    const templates = validateCareTaskTemplates(program.taskTemplates);
    if (
      !templates ||
      !validateCareRuleDataSources(
        sanitizedRules as CareRuleNode[],
        sanitizedSources,
        templates,
      )
    )
      this.projectionUnavailable('Rule configuration is invalid');
    const tests = this.sanitizeTestResults(rule.testResults);
    const base = {
      id: this.requiredId(rule._id),
      careProgramId: this.requiredId(rule.careProgramId),
      version: this.requiredPositiveInteger(rule.version, 'Rule version'),
      status: rule.status as CareRuleStatus,
      ...(tests.testSummary ? { testSummary: tests.testSummary } : {}),
    };

    if (actor.role === UserRole.DOCTOR) {
      if (base.status !== CareRuleStatus.ACTIVE)
        this.projectionUnavailable('Active Rule status is invalid');
      return base as DoctorCareRuleProjectionDto;
    }

    if (
      base.status !== CareRuleStatus.ACTIVE &&
      base.status !== CareRuleStatus.DRAFT
    )
      this.projectionUnavailable('Admin Rule status is invalid');
    return {
      ...base,
      revision: this.requiredPositiveInteger(rule.revision, 'Rule revision'),
      rules: sanitizedRules,
      dataSources: sanitizedSources,
      ...(tests.testResults ? { testResults: tests.testResults } : {}),
    } as AdminCareRuleProjectionDto;
  }

  private sanitizeRules(value: unknown): SanitizedDeclarativeRuleDto[] {
    if (!Array.isArray(value))
      this.projectionUnavailable('Rule declarations are invalid');
    const state = { count: 0 };
    return value.map((node) => this.sanitizeRuleNode(node, 1, state));
  }

  private sanitizeRuleNode(
    value: unknown,
    depth: number,
    state: { count: number },
  ): SanitizedDeclarativeRuleDto {
    if (!this.isRecord(value) || depth > MAX_RULE_DEPTH)
      this.projectionUnavailable('Rule declaration depth is invalid');
    state.count += 1;
    if (state.count > MAX_RULE_NODES)
      this.projectionUnavailable('Rule declaration is too large');
    const operator = value.operator;
    if (typeof operator !== 'string' || !ALL_OPERATORS.has(operator))
      this.projectionUnavailable('Rule operator is invalid');

    const common: SanitizedDeclarativeRuleDto = { operator };
    if (value.reasonCode !== undefined) {
      if (
        typeof value.reasonCode !== 'string' ||
        !SAFE_CODE.test(value.reasonCode)
      )
        this.projectionUnavailable('Rule reason code is invalid');
      common.reasonCode = value.reasonCode;
    }
    if (value.severity !== undefined) {
      if (
        typeof value.severity !== 'string' ||
        !RULE_SEVERITIES.has(value.severity)
      )
        this.projectionUnavailable('Rule severity is invalid');
      common.severity = value.severity as 'attention' | 'urgent';
    }

    if (GROUP_OPERATORS.has(operator)) {
      if (!Array.isArray(value.rules))
        this.projectionUnavailable('Nested Rule declarations are invalid');
      this.assertOnlyKeys(value, [
        'operator',
        'rules',
        'reasonCode',
        'severity',
      ]);
      return {
        ...common,
        rules: value.rules.map((child) =>
          this.sanitizeRuleNode(child, depth + 1, state),
        ),
      };
    }

    if (typeof value.key !== 'string' || !SAFE_KEY.test(value.key))
      this.projectionUnavailable('Rule fact key is invalid');
    common.key = value.key;
    if (operator === 'exists') {
      this.assertOnlyKeys(value, ['operator', 'key', 'reasonCode', 'severity']);
      return common;
    }
    if (operator === 'between') {
      if (!this.isFiniteNumber(value.min) || !this.isFiniteNumber(value.max))
        this.projectionUnavailable('Rule range is invalid');
      if (value.min > value.max)
        this.projectionUnavailable('Rule range is reversed');
      this.assertOnlyKeys(value, [
        'operator',
        'key',
        'min',
        'max',
        'reasonCode',
        'severity',
      ]);
      return { ...common, min: value.min, max: value.max };
    }
    if (NUMERIC_OPERATORS.has(operator)) {
      if (!this.isFiniteNumber(value.value))
        this.projectionUnavailable('Numeric Rule value is invalid');
    } else if (!this.isPrimitive(value.value)) {
      this.projectionUnavailable('Rule value is invalid');
    }
    if (typeof value.value === 'string' && value.value.length > 256)
      this.projectionUnavailable('Rule value is too long');
    this.assertOnlyKeys(value, [
      'operator',
      'key',
      'value',
      'reasonCode',
      'severity',
    ]);
    return { ...common, value: value.value };
  }

  private sanitizeDataSources(value: unknown): SanitizedRuleDataSourceDto[] {
    if (!Array.isArray(value) || value.length > MAX_DATA_SOURCES)
      this.projectionUnavailable('Rule data sources are invalid');
    return value.map((item) => {
      if (!this.isRecord(item))
        this.projectionUnavailable('Rule data source is invalid');
      this.assertOnlyKeys(item, [
        'kind',
        'schemaVersion',
        'templateKey',
        'allowedFactPrefixes',
      ]);
      if (
        item.kind !== 'care_task_check_in' ||
        item.schemaVersion !== HEALTH_CHECK_IN_SCHEMA_VERSION ||
        typeof item.templateKey !== 'string' ||
        !TEMPLATE_KEY.test(item.templateKey) ||
        !this.isStringArray(item.allowedFactPrefixes) ||
        item.allowedFactPrefixes.length === 0 ||
        item.allowedFactPrefixes.length > 16 ||
        item.allowedFactPrefixes.some((prefix) => !FACT_PREFIXES.has(prefix)) ||
        new Set(item.allowedFactPrefixes).size !==
          item.allowedFactPrefixes.length
      )
        this.projectionUnavailable('Rule data source mapping is invalid');
      return {
        kind: 'care_task_check_in',
        schemaVersion: HEALTH_CHECK_IN_SCHEMA_VERSION,
        templateKey: item.templateKey,
        allowedFactPrefixes: [...item.allowedFactPrefixes],
      };
    });
  }

  private sanitizeTestResults(value: unknown): TestProjection {
    if (value === undefined || value === null) return {};
    if (!this.isRecord(value))
      this.projectionUnavailable('Rule test evidence is invalid');
    if (Object.keys(value).length === 0) return {};
    const summaryKeys = [
      'status',
      'total',
      'passed',
      'failed',
      'reasonCodes',
      'interpreterVersion',
      'executedAt',
    ];
    const hasTopLevelSummary = summaryKeys.some((key) => key in value);
    const summarySource =
      value.summary !== undefined
        ? value.summary
        : hasTopLevelSummary
          ? value
          : undefined;
    const projection: TestProjection = {};
    if (summarySource !== undefined) {
      if (!this.isRecord(summarySource))
        this.projectionUnavailable('Rule test summary is invalid');
      projection.testSummary = this.sanitizeTestSummary(summarySource);
    }
    if (value.scenarios !== undefined) {
      if (!Array.isArray(value.scenarios))
        this.projectionUnavailable('Rule test scenarios are invalid');
      projection.testResults = value.scenarios
        .slice(0, MAX_SCENARIOS)
        .map((scenario) => this.sanitizeScenario(scenario));
    }
    if (!projection.testSummary && !projection.testResults)
      this.projectionUnavailable('Rule test evidence has no supported fields');
    return projection;
  }

  private sanitizeTestSummary(
    value: Record<string, unknown>,
  ): CareRuleTestSummaryDto {
    if (typeof value.status !== 'string' || !TEST_STATUSES.has(value.status))
      this.projectionUnavailable('Rule test status is invalid');
    const output: CareRuleTestSummaryDto = {
      status: value.status as CareRuleTestSummaryDto['status'],
    };
    for (const key of ['total', 'passed', 'failed'] as const) {
      if (value[key] === undefined) continue;
      if (!this.isNonNegativeInteger(value[key]))
        this.projectionUnavailable(`Rule test ${key} is invalid`);
      output[key] = value[key];
    }
    if (
      output.total !== undefined &&
      (output.passed ?? 0) + (output.failed ?? 0) > output.total
    )
      this.projectionUnavailable('Rule test counts are inconsistent');
    const reasonCodes = this.sanitizeReasonCodes(value.reasonCodes);
    if (reasonCodes) output.reasonCodes = reasonCodes;
    if (value.interpreterVersion !== undefined) {
      if (
        typeof value.interpreterVersion !== 'string' ||
        !SAFE_CODE.test(value.interpreterVersion)
      )
        this.projectionUnavailable('Rule interpreter version is invalid');
      output.interpreterVersion = value.interpreterVersion;
    }
    if (value.executedAt !== undefined)
      output.executedAt = this.requiredIso(
        value.executedAt,
        'Rule test timestamp is invalid',
      );
    return output;
  }

  private sanitizeScenario(value: unknown): CareRuleScenarioResultDto {
    if (!this.isRecord(value))
      this.projectionUnavailable('Rule test scenario is invalid');
    if (
      typeof value.scenarioKey !== 'string' ||
      value.scenarioKey.length === 0 ||
      value.scenarioKey.length > 120 ||
      [...value.scenarioKey].some((character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127;
      }) ||
      typeof value.passed !== 'boolean'
    )
      this.projectionUnavailable('Rule test scenario identity is invalid');
    const output: CareRuleScenarioResultDto = {
      scenarioKey: value.scenarioKey,
      passed: value.passed,
    };
    for (const key of ['expectedSeverity', 'actualSeverity'] as const) {
      if (value[key] === undefined) continue;
      if (typeof value[key] !== 'string' || !SEVERITIES.has(value[key]))
        this.projectionUnavailable('Rule test scenario severity is invalid');
      output[key] = value[key] as 'normal' | 'attention' | 'urgent';
    }
    const reasonCodes = this.sanitizeReasonCodes(value.reasonCodes);
    if (reasonCodes) output.reasonCodes = reasonCodes;
    return output;
  }

  private sanitizeReasonCodes(value: unknown): string[] | undefined {
    if (value === undefined) return undefined;
    if (
      !Array.isArray(value) ||
      value.length > MAX_REASON_CODES ||
      value.some((code) => typeof code !== 'string' || !SAFE_CODE.test(code))
    )
      this.projectionUnavailable('Rule test reason codes are invalid');
    return [...new Set(value as string[])];
  }

  private assertOnlyKeys(
    value: Record<string, unknown>,
    allowed: readonly string[],
  ): void {
    if (Object.keys(value).some((key) => !allowed.includes(key)))
      this.projectionUnavailable(
        'Rule declaration contains unsupported fields',
      );
  }

  private requiredId(value: unknown): string {
    if (value instanceof Types.ObjectId) return value.toHexString();
    if (typeof value === 'string' && Types.ObjectId.isValid(value))
      return value;
    this.projectionUnavailable('Rule identifier is invalid');
  }

  private requiredPositiveInteger(value: unknown, label: string): number {
    if (!Number.isSafeInteger(value) || Number(value) < 1)
      this.projectionUnavailable(`${label} is invalid`);
    return Number(value);
  }

  private requiredIso(value: unknown, message: string): string {
    if (
      !(value instanceof Date) &&
      typeof value !== 'string' &&
      typeof value !== 'number'
    )
      this.projectionUnavailable(message);
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) this.projectionUnavailable(message);
    return date.toISOString();
  }

  private objectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) this.ruleNotFound();
    return new Types.ObjectId(value);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private isStringArray(value: unknown): value is string[] {
    return (
      Array.isArray(value) && value.every((item) => typeof item === 'string')
    );
  }

  private isPrimitive(value: unknown): value is number | string | boolean {
    return (
      this.isFiniteNumber(value) ||
      typeof value === 'string' ||
      typeof value === 'boolean'
    );
  }

  private isNonNegativeInteger(value: unknown): value is number {
    return Number.isSafeInteger(value) && Number(value) >= 0;
  }

  private forbidden(): never {
    throw new HttpException(
      { code: 'CARE_FORBIDDEN', message: 'Care Rule is not accessible' },
      HttpStatus.FORBIDDEN,
    );
  }

  private ruleNotFound(): never {
    throw new HttpException(
      { code: 'CARE_RULE_NOT_FOUND', message: 'Care Rule not found' },
      HttpStatus.NOT_FOUND,
    );
  }

  private projectionUnavailable(message: string): never {
    throw new HttpException(
      { code: 'CARE_RULE_PROJECTION_UNAVAILABLE', message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
