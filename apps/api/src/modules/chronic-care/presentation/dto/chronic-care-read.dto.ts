import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PageSortQueryDto } from '../../../../common/pagination';
import { CareProgramStatus } from '../../domain/entities/care-program.entity';
import { PatientCareProgramStatus } from '../../domain/entities/patient-care-program.entity';

export class QueryCareProgramsDto extends PageSortQueryDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  diseaseKey?: string;

  @ApiPropertyOptional({ enum: CareProgramStatus })
  @IsOptional()
  @IsEnum(CareProgramStatus)
  status?: CareProgramStatus;

  @ApiPropertyOptional({
    enum: ['publishedAt', 'name', 'programCode', 'version'],
  })
  @IsOptional()
  @IsIn(['publishedAt', 'name', 'programCode', 'version'])
  sortBy: 'publishedAt' | 'name' | 'programCode' | 'version' = 'publishedAt';
}

export class QueryCareEnrollmentsDto extends PageSortQueryDto {
  @ApiPropertyOptional({ enum: PatientCareProgramStatus })
  @IsOptional()
  @IsEnum(PatientCareProgramStatus)
  status?: PatientCareProgramStatus;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  programCode?: string;

  @ApiPropertyOptional({
    description: 'Conjunctive filter; never overrides JWT ownership.',
  })
  @IsOptional()
  @IsMongoId()
  patientId?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt'] })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt'])
  sortBy: 'createdAt' | 'updatedAt' = 'updatedAt';
}

export class CareIdentitySummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() fullName: string;
  @ApiPropertyOptional() avatarUrl?: string;
  @ApiPropertyOptional() specialty?: string;
}

export class CareProgramSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() programCode: string;
  @ApiProperty() version: number;
  @ApiProperty() name: string;
  @ApiProperty() diseaseKey: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty({ enum: CareProgramStatus }) status: CareProgramStatus;
  @ApiPropertyOptional() publishedAt?: string;
  @ApiPropertyOptional() retiredAt?: string;
}

export class CareProgramPageDto {
  @ApiProperty({ type: [CareProgramSummaryDto] })
  items: CareProgramSummaryDto[];
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}

export class CareProgramDetailDto extends CareProgramSummaryDto {
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  eligibilityForm?: Record<string, unknown>;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  baselineForm?: Record<string, unknown>;
  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  taskTemplates?: Record<string, unknown>[];
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  reminderPolicy?: Record<string, unknown>;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  reviewPolicy?: Record<string, unknown>;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  completionCriteria?: Record<string, unknown>;
  @ApiPropertyOptional({ type: [String] }) doctorEditableFields?: string[];
  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  contentJourney?: Record<string, unknown>[];
  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  dataSources?: Record<string, unknown>[];
  @ApiPropertyOptional() revision?: number;
  @ApiPropertyOptional() createdBy?: string;
  @ApiPropertyOptional() publishedBy?: string;
  @ApiPropertyOptional() retiredBy?: string;
  @ApiPropertyOptional() createdAt?: string;
  @ApiPropertyOptional() updatedAt?: string;
}

export class CareEnrollmentSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: CareProgramSummaryDto }) program: CareProgramSummaryDto;
  @ApiProperty({ enum: PatientCareProgramStatus })
  status: PatientCareProgramStatus;
  @ApiPropertyOptional({ type: CareIdentitySummaryDto })
  patient?: CareIdentitySummaryDto;
  @ApiPropertyOptional({ type: CareIdentitySummaryDto })
  assignedDoctor?: CareIdentitySummaryDto;
  @ApiProperty() timezone: string;
  @ApiProperty({ type: [String] }) allowedActions: string[];
  @ApiPropertyOptional() startedAt?: string;
  @ApiPropertyOptional() expectedEndAt?: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

export class CareEnrollmentPageDto {
  @ApiProperty({ type: [CareEnrollmentSummaryDto] })
  items: CareEnrollmentSummaryDto[];
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}

export class CareEnrollmentDetailDto extends CareEnrollmentSummaryDto {
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  consent?: Record<string, unknown>;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  baseline?: Record<string, unknown>;
  @ApiProperty({ type: 'object', additionalProperties: true })
  taskSummary: Record<string, unknown>;
  @ApiProperty({ type: 'object', additionalProperties: true })
  alertSummary: Record<string, unknown>;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  latestReport?: Record<string, unknown>;
}
