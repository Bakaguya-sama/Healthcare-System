import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
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
