import { IsEnum, IsOptional, IsDateString, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { MetricType } from '../entities/health-metric.entity';

export class QueryHealthMetricDto {
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

  @ApiProperty({ example: 1, default: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @ApiProperty({ example: 10, default: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiProperty({ example: 'recordedAt', required: false })
  @IsOptional()
  sortBy?: string = 'recordedAt';

  @ApiProperty({ example: '-1', required: false })
  @Type(() => Number)
  @IsOptional()
  sortOrder?: 1 | -1 = -1;
}
