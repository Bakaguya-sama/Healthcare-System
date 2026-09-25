import {
  IsEnum,
  IsOptional,
  IsDateString,
  IsMongoId,
  IsIn,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MetricType } from '../entities/health-metric.entity';
import { PageSortQueryDto } from '../../../common/pagination';

export const HEALTH_METRIC_SORT_FIELDS = ['recordedAt', 'createdAt'] as const;
export type HealthMetricSortField = (typeof HEALTH_METRIC_SORT_FIELDS)[number];

export class QueryHealthMetricDto extends PageSortQueryDto {
  @ApiProperty({
    required: false,
    description: 'Opaque cursor for metric history',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
  @ApiProperty({ enum: MetricType, required: false })
  @IsEnum(MetricType)
  @IsOptional()
  type?: MetricType;

  @ApiProperty({ example: '2026-01-01T00:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: '2026-03-16T23:59:59Z', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: '65f41674a24154d7cc185139', required: false })
  @IsMongoId()
  @IsOptional()
  patientId?: string;

  @ApiProperty({ enum: HEALTH_METRIC_SORT_FIELDS, required: false })
  @IsOptional()
  @IsIn(HEALTH_METRIC_SORT_FIELDS)
  sortBy: HealthMetricSortField = 'recordedAt';
}
