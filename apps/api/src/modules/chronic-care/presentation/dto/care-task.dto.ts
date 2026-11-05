import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  IsMongoId,
} from 'class-validator';
import { PageSortQueryDto } from '../../../../common/pagination';
import {
  CareTaskStatus,
  CareTaskType,
} from '../../domain/entities/care-task.entity';

export class QueryEnrollmentCareTasksDto extends PageSortQueryDto {
  @ApiPropertyOptional({ enum: CareTaskStatus })
  @IsOptional()
  @IsEnum(CareTaskStatus)
  status?: CareTaskStatus;

  @ApiPropertyOptional({ enum: CareTaskType })
  @IsOptional()
  @IsEnum(CareTaskType)
  type?: CareTaskType;

  @ApiPropertyOptional({
    description: 'Inclusive ISO-8601 scheduledFor lower bound',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive ISO-8601 scheduledFor upper bound',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: ['scheduledFor', 'windowStart', 'updatedAt'] })
  @IsOptional()
  @IsIn(['scheduledFor', 'windowStart', 'updatedAt'])
  sortBy: 'scheduledFor' | 'windowStart' | 'updatedAt' = 'scheduledFor';
}

export enum CareTaskResponseAction {
  ACKNOWLEDGE = 'acknowledge',
}

export enum HealthCheckInOverallStatus {
  IMPROVED = 'improved',
  STABLE = 'stable',
  WORSENED = 'worsened',
}

export enum HealthCheckInSeverity {
  NONE = 'none',
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
}

export enum DoctorReviewReasonCode {
  REVIEWED_NO_ACTION = 'reviewed_no_action',
  FOLLOW_UP_NEEDED = 'follow_up_needed',
  CONSULTATION_RECOMMENDED = 'consultation_recommended',
  CARE_PLAN_ADJUSTMENT_NEEDED = 'care_plan_adjustment_needed',
}

export class SubmitCareTaskResponseDto {
  @ApiPropertyOptional({ enum: CareTaskResponseAction })
  @IsOptional()
  @IsEnum(CareTaskResponseAction)
  action?: CareTaskResponseAction;

  @ApiPropertyOptional({ enum: HealthCheckInOverallStatus })
  @IsOptional()
  @IsEnum(HealthCheckInOverallStatus)
  overallStatus?: HealthCheckInOverallStatus;

  @ApiPropertyOptional({
    type: [String],
    maxItems: 8,
    description: 'Unique snake_case codes allowlisted by the task snapshot',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-z][a-z0-9_]{0,63}$/, { each: true })
  symptomCodes?: string[];

  @ApiPropertyOptional({ enum: HealthCheckInSeverity })
  @IsOptional()
  @IsEnum(HealthCheckInSeverity)
  severity?: HealthCheckInSeverity;
}

export class SubmitDoctorReviewDto {
  @ApiProperty({ enum: DoctorReviewReasonCode })
  @IsEnum(DoctorReviewReasonCode)
  reasonCode: DoctorReviewReasonCode;

  @ApiPropertyOptional({ maxLength: 500, description: 'Plain text only' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^(?![\s\S]*<[^>]+>)[\s\S]*$/, {
    message: 'note must be plain text without HTML markup',
  })
  note?: string;
}

export class LinkCareTaskConsultationDto {
  @ApiProperty()
  @IsMongoId()
  consultationId: string;
}

export class CareTaskSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() enrollmentId: string;
  @ApiProperty({ enum: CareTaskType }) taskType: CareTaskType;
  @ApiProperty() templateKey: string;
  @ApiProperty({ enum: CareTaskStatus }) status: CareTaskStatus;
  @ApiProperty() required: boolean;
  @ApiProperty() scheduledFor: string;
  @ApiProperty() windowStart: string;
  @ApiProperty() windowEnd: string;
  @ApiPropertyOptional() completedAt?: string;
  @ApiPropertyOptional() missedAt?: string;
  @ApiPropertyOptional() cancelledAt?: string;
  @ApiProperty({ type: [String] }) allowedActions: string[];
}

export class CareTaskPageDto {
  @ApiProperty({ type: [CareTaskSummaryDto] }) items: CareTaskSummaryDto[];
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}

export class CareTaskDetailDto extends CareTaskSummaryDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  presentation: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  progress: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  consultationReference?: Record<string, unknown>;
}

export class CareTaskResponseResultDto {
  @ApiProperty({ type: CareTaskDetailDto }) task: CareTaskDetailDto;
  @ApiProperty() replayed: boolean;
}
