import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHealthMetricDto {
  @ApiProperty({ example: 'blood_pressure' })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({ example: 120 })
  @IsNumber()
  value: number;

  @ApiProperty({ example: 'mmHg' })
  @IsString()
  unit: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ example: '2026-03-11T10:00:00Z' })
  @IsDateString()
  recordedAt: string;
}
