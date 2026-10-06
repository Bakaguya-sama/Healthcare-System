import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { CareReportType } from '../../domain/entities/care-report.entity';

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
