import {
  IsString,
  IsEnum,
  IsOptional,
  IsMongoId,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportType, ViolationStatus } from '../entities/violation.entity';

export class CreateViolationDto {
  @ApiPropertyOptional({
    description: 'ID of reporter (Optional if AI detection)',
    type: String,
  })
  @IsOptional()
  @IsMongoId()
  reporter_id?: string;

  @ApiPropertyOptional({
    description: 'ID of reported user (Optional if AI is reported)',
    type: String,
  })
  @IsOptional()
  @IsMongoId()
  reported_user_id?: string;

  @ApiProperty({
    enum: ReportType,
    description: 'Type of violation',
    example: ReportType.HARASSMENT,
  })
  @IsEnum(ReportType)
  report_type: ReportType;

  @ApiProperty({
    description: 'Reason for report',
    example: 'Doctor arrived late to session',
    maxLength: 1000,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason: string;
}

export class UpdateViolationDto {
  @ApiPropertyOptional({
    description: 'Resolution note',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolution_note?: string;

  @ApiPropertyOptional({
    enum: ViolationStatus,
    description: 'Violation status',
  })
  @IsOptional()
  @IsEnum(ViolationStatus)
  status?: ViolationStatus;
}

export class QueryViolationDto {
  @ApiPropertyOptional({ description: 'Status filter', enum: ViolationStatus })
  @IsOptional()
  @IsEnum(ViolationStatus)
  status?: ViolationStatus;

  @ApiPropertyOptional({ description: 'Report type filter', enum: ReportType })
  @IsOptional()
  @IsEnum(ReportType)
  report_type?: ReportType;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Page limit', default: 20 })
  @IsOptional()
  limit?: number;
}
