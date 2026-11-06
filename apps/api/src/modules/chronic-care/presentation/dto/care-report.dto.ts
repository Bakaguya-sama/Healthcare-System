import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsIn, IsOptional } from 'class-validator';
import { CareReportType } from '../../domain/entities/care-report.entity';
import {
  CareReportExportFormat,
  CareReportExportStatus,
} from '../../domain/entities/care-report-export.entity';

export class GenerateCareReportDto {
  @ApiProperty({ enum: CareReportType })
  @IsEnum(CareReportType)
  reportType: CareReportType;

  @ApiProperty({
    description: 'UTC cutoff; sources updated after this instant are excluded',
  })
  @IsDateString()
  dataUntil: string;
}

export class QueryCareReportDto {
  @ApiPropertyOptional({ enum: CareReportType })
  @IsOptional()
  @IsEnum(CareReportType)
  reportType?: CareReportType;
}

export class GenerateCareSummaryDto {
  @ApiPropertyOptional({ enum: ['patient', 'doctor'] })
  @IsOptional()
  @IsIn(['patient', 'doctor'])
  audience?: 'patient' | 'doctor';
}

export class CreateCareReportExportDto {
  @ApiProperty({ enum: CareReportExportFormat })
  @IsEnum(CareReportExportFormat)
  format: CareReportExportFormat;
}

export class CareReportExportDownloadDto {
  @ApiProperty() url: string;
  @ApiProperty({ format: 'date-time' }) expiresAt: string;
}

export class CareReportExportDto {
  @ApiProperty() id: string;
  @ApiProperty() careReportId: string;
  @ApiProperty() reportVersion: number;
  @ApiProperty({ enum: CareReportExportFormat }) format: CareReportExportFormat;
  @ApiProperty({ enum: CareReportExportStatus }) status: CareReportExportStatus;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
  @ApiPropertyOptional({ format: 'date-time' }) expiresAt?: string;
  @ApiPropertyOptional({ type: CareReportExportDownloadDto })
  download?: CareReportExportDownloadDto;
  @ApiPropertyOptional() failureReasonCode?: string;
  @ApiPropertyOptional({
    description: 'True only when POST replayed the same key and payload',
  })
  replayed?: boolean;
}
