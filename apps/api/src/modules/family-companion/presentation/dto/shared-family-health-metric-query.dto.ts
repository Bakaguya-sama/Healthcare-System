import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { FamilyHealthMetricPeriod } from '../../domain/policies/health-metric-period.policy';

export class SharedFamilyHealthMetricQueryDto {
  @ApiProperty({ example: 'weight' })
  @IsString()
  metricType!: string;

  @ApiPropertyOptional({
    enum: ['week', 'month', 'quarter', 'year', 'all', 'custom'],
    default: 'week',
  })
  @IsOptional()
  @IsIn(['week', 'month', 'quarter', 'year', 'all', 'custom'])
  period?: FamilyHealthMetricPeriod;

  @ApiPropertyOptional({
    example: '2026-11-23',
    description: 'Ngày neo lịch YYYY-MM-DD theo Asia/Ho_Chi_Minh',
  })
  @IsOptional()
  @IsString()
  anchor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
