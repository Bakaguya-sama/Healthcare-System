import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsIn, IsOptional } from 'class-validator';
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

export class SubmitCareTaskResponseDto {
  @ApiProperty({ enum: CareTaskResponseAction })
  @IsEnum(CareTaskResponseAction)
  action: CareTaskResponseAction;
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
