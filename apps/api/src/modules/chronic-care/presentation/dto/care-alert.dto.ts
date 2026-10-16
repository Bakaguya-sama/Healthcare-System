import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { CursorQueryDto } from '../../../../common/pagination';
import { CareAlertStatus } from '../../domain/entities/care-alert.entity';
import { HealthEvaluationSeverity } from '../../domain/entities/health-evaluation.entity';

export class QueryDoctorCareAlertsDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: CareAlertStatus })
  @IsOptional()
  @IsEnum(CareAlertStatus)
  status?: CareAlertStatus;

  @ApiPropertyOptional({
    enum: [HealthEvaluationSeverity.ATTENTION, HealthEvaluationSeverity.URGENT],
  })
  @IsOptional()
  @IsIn([HealthEvaluationSeverity.ATTENTION, HealthEvaluationSeverity.URGENT])
  severity?: HealthEvaluationSeverity;
}

export class CreateConsultationFromCareAlertDto {
  @IsOptional()
  @IsDateString()
  scheduledStartAt?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(180)
  expectedDurationMinutes?: number;

  @IsOptional()
  @IsString()
  followUpNote?: string;

  @IsOptional()
  @IsString()
  nextAction?: string;
}
