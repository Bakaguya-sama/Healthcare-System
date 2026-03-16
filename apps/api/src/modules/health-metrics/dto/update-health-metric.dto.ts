import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsDate,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';
import { CreateHealthMetricDto } from './create-health-metric.dto';
import { MetricStatus } from '../entities/health-metric.entity';

export class UpdateHealthMetricDto extends PartialType(
  CreateHealthMetricDto,
) {
  @ApiProperty({ enum: MetricStatus, required: false })
  @IsEnum(MetricStatus)
  @IsOptional()
  status?: MetricStatus;

  @ApiProperty({ example: 'Updated note', required: false })
  @IsString()
  @IsOptional()
  note?: string;
}
