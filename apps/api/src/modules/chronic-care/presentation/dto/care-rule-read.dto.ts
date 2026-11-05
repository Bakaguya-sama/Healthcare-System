import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { CareRuleStatus } from '../../domain/entities/care-rule.entity';

export enum CareRuleReadView {
  ACTIVE = 'active',
  DRAFT = 'draft',
}

export class QueryCareRuleDto {
  @ApiPropertyOptional({
    enum: CareRuleReadView,
    default: CareRuleReadView.ACTIVE,
  })
  @IsEnum(CareRuleReadView)
  view: CareRuleReadView = CareRuleReadView.ACTIVE;
}

export class CareRuleTestSummaryDto {
  @ApiProperty({ enum: ['passed', 'failed', 'unavailable'] })
  status: 'passed' | 'failed' | 'unavailable';
  @ApiPropertyOptional({ minimum: 0 }) total?: number;
  @ApiPropertyOptional({ minimum: 0 }) passed?: number;
  @ApiPropertyOptional({ minimum: 0 }) failed?: number;
  @ApiPropertyOptional({ type: [String], maxItems: 32 })
  reasonCodes?: string[];
  @ApiPropertyOptional({ maxLength: 80 }) interpreterVersion?: string;
  @ApiPropertyOptional() executedAt?: string;
}

export class CareRuleScenarioResultDto {
  @ApiProperty({ maxLength: 120 }) scenarioKey: string;
  @ApiProperty() passed: boolean;
  @ApiPropertyOptional({ enum: ['normal', 'attention', 'urgent'] })
  expectedSeverity?: 'normal' | 'attention' | 'urgent';
  @ApiPropertyOptional({ enum: ['normal', 'attention', 'urgent'] })
  actualSeverity?: 'normal' | 'attention' | 'urgent';
  @ApiPropertyOptional({ type: [String], maxItems: 32 })
  reasonCodes?: string[];
}

export class SanitizedDeclarativeRuleDto {
  @ApiProperty({
    enum: [
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
    ],
  })
  operator: string;
  @ApiPropertyOptional() key?: string;
  @ApiPropertyOptional({
    oneOf: [{ type: 'number' }, { type: 'string' }, { type: 'boolean' }],
  })
  value?: number | string | boolean;
  @ApiPropertyOptional() min?: number;
  @ApiPropertyOptional() max?: number;
  @ApiPropertyOptional({ type: () => [SanitizedDeclarativeRuleDto] })
  rules?: SanitizedDeclarativeRuleDto[];
  @ApiPropertyOptional() reasonCode?: string;
  @ApiPropertyOptional({ enum: ['attention', 'urgent'] })
  severity?: 'attention' | 'urgent';
}

export class SanitizedRuleDataSourceDto {
  @ApiProperty({ enum: ['care_task_check_in'] })
  kind: 'care_task_check_in';
  @ApiProperty({ enum: ['health-check-in.v1'] })
  schemaVersion: 'health-check-in.v1';
  @ApiProperty() templateKey: string;
  @ApiProperty({ type: [String] }) allowedFactPrefixes: string[];
}

export class DoctorCareRuleProjectionDto {
  @ApiProperty() id: string;
  @ApiProperty() careProgramId: string;
  @ApiProperty() version: number;
  @ApiProperty({ enum: [CareRuleStatus.ACTIVE] })
  status: CareRuleStatus.ACTIVE;
  @ApiPropertyOptional({ type: CareRuleTestSummaryDto })
  testSummary?: CareRuleTestSummaryDto;
}

export class AdminCareRuleProjectionDto {
  @ApiProperty() id: string;
  @ApiProperty() careProgramId: string;
  @ApiProperty() version: number;
  @ApiProperty() revision: number;
  @ApiProperty({ enum: [CareRuleStatus.DRAFT, CareRuleStatus.ACTIVE] })
  status: CareRuleStatus.DRAFT | CareRuleStatus.ACTIVE;
  @ApiProperty({ type: [SanitizedDeclarativeRuleDto] })
  rules: SanitizedDeclarativeRuleDto[];
  @ApiProperty({ type: [SanitizedRuleDataSourceDto] })
  dataSources: SanitizedRuleDataSourceDto[];
  @ApiPropertyOptional({ type: CareRuleTestSummaryDto })
  testSummary?: CareRuleTestSummaryDto;
  @ApiPropertyOptional({
    type: [CareRuleScenarioResultDto],
    maxItems: 50,
    description: 'Sanitized evidence only; never raw CareRule.testResults.',
  })
  testResults?: CareRuleScenarioResultDto[];
}
