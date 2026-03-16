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
import { MetricType, MetricStatus } from '../entities/health-metric.entity';

export class CreateHealthMetricDto {
  @ApiProperty({ enum: MetricType, example: 'blood_pressure' })
  @IsEnum(MetricType)
  type: MetricType;

  @ApiProperty({ example: 120 })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({ example: 120, required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  systolic?: number; // Blood pressure systolic

  @ApiProperty({ example: 80, required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  diastolic?: number; // Blood pressure diastolic

  @ApiProperty({ example: 'mmHg' })
  @IsString()
  unit: string;

  @ApiProperty({ enum: MetricStatus, required: false })
  @IsEnum(MetricStatus)
  @IsOptional()
  status?: MetricStatus;

  @ApiProperty({ example: 'Regular measurement', required: false })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({ example: '2026-03-16T20:30:00Z', required: false })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  recordedAt?: Date;

  @ApiProperty({ example: 'Dr. Nguyen', required: false })
  @IsString()
  @IsOptional()
  doctor?: string;
}
