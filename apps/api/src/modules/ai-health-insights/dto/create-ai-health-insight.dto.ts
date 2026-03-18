import { IsString, IsEnum, IsObject, IsArray, IsOptional, IsMongoId } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RiskLevel } from '../entities/ai-health-insight.entity';

export class CreateAiHealthInsightDto {
  @IsMongoId()
  @ApiProperty({ description: 'Patient ID' })
  userId: string;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({ description: 'Analyzed metrics' })
  relatedMetrics?: Record<string, any>;
}

export class UpdateAiHealthInsightDto {
  @IsOptional()
  @IsEnum(RiskLevel)
  @ApiPropertyOptional({ description: 'Risk level', enum: Object.values(RiskLevel) })
  riskLevel?: RiskLevel;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Advice' })
  advice?: string;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({ description: 'Analyzed metrics' })
  analyzedMetrics?: Record<string, any>;
}

export class QueryAiHealthInsightDto {
  @IsOptional()
  @IsMongoId()
  @ApiPropertyOptional({ description: 'Filter by patient ID' })
  patientId?: string;

  @IsOptional()
  @IsEnum(RiskLevel)
  @ApiPropertyOptional({ description: 'Filter by risk level', enum: Object.values(RiskLevel) })
  riskLevel?: RiskLevel;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Field to sort by' })
  sortBy?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Sort direction (asc/desc)' })
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @ApiPropertyOptional({ description: 'Page number' })
  page?: number;

  @IsOptional()
  @ApiPropertyOptional({ description: 'Items per page' })
  limit?: number;
}
