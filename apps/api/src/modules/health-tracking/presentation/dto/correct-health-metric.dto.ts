import { Type } from 'class-transformer';
import {
  IsDate,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CorrectHealthMetricDto {
  @ApiProperty({ type: Object, example: { systolic: 118, diastolic: 78 } })
  @IsObject()
  values: Record<string, number>;

  @ApiProperty({ example: '2026-03-16T20:30:00Z' })
  @IsDate()
  @Type(() => Date)
  recordedAt: Date;

  @ApiProperty({ example: 'Asia/Ho_Chi_Minh', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  recordedTimezone?: string;

  @ApiProperty({ example: 'Corrected an input mistake' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class VoidHealthMetricDto {
  @ApiProperty({ example: 'Measurement was entered for the wrong patient' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
