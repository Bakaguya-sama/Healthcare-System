import { IsString, IsEnum, IsObject, IsArray, IsOptional, IsDateString, IsBoolean, ValidateNested, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InsightType, ConfidenceLevel } from '../entities/ai-health-insight.entity';

export class CreateAiHealthInsightDto {
  @IsMongoId()
  @ApiProperty({ description: 'Patient/User ID' })
  userId: string;

  @IsEnum(InsightType)
  @ApiProperty({ description: 'Type of insight', enum: Object.values(InsightType) })
  insightType: InsightType;

  @IsString()
  @ApiProperty({ description: 'Metric being analyzed' })
  metricType: string;

  @IsString()
  @ApiProperty({ description: 'Title/summary of insight' })
  title: string;

  @IsString()
  @ApiProperty({ description: 'Detailed description' })
  description: string;

  @IsObject()
  @ApiProperty({ description: 'Analysis data' })
  analysisData: Record<string, any>;

  @IsEnum(ConfidenceLevel)
  @ApiProperty({ description: 'Confidence level', enum: Object.values(ConfidenceLevel) })
  confidenceLevel: ConfidenceLevel;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Recommended action' })
  recommendedAction?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @ApiPropertyOptional({ description: 'Related metric IDs', type: [String] })
  relatedMetrics?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({ description: 'Related health condition keywords', type: [String] })
  healthConditions?: string[];

  @IsDateString()
  @ApiProperty({ description: 'When insight period started' })
  periodStart: Date;

  @IsDateString()
  @ApiProperty({ description: 'When insight period ended' })
  periodEnd: Date;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: Record<string, any>;
}

export class UpdateAiHealthInsightDto {
  @IsOptional()
  @IsEnum(InsightType)
  @ApiPropertyOptional({ description: 'Type of insight', enum: Object.values(InsightType) })
  insightType?: InsightType;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Title/summary' })
  title?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Detailed description' })
  description?: string;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({ description: 'Analysis data' })
  analysisData?: Record<string, any>;

  @IsOptional()
  @IsEnum(ConfidenceLevel)
  @ApiPropertyOptional({ description: 'Confidence level', enum: Object.values(ConfidenceLevel) })
  confidenceLevel?: ConfidenceLevel;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Recommended action' })
  recommendedAction?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @ApiPropertyOptional({ description: 'Related metric IDs', type: [String] })
  relatedMetrics?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({ description: 'Related health condition keywords', type: [String] })
  healthConditions?: string[];

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ description: 'Mark as notified' })
  notified?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ description: 'Mark as acknowledged' })
  acknowledged?: boolean;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: Record<string, any>;
}

export class QueryAiHealthInsightDto {
  @IsOptional()
  @IsMongoId()
  @ApiPropertyOptional({ description: 'Filter by user ID' })
  userId?: string;

  @IsOptional()
  @IsEnum(InsightType)
  @ApiPropertyOptional({ description: 'Filter by insight type', enum: Object.values(InsightType) })
  insightType?: InsightType;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Filter by metric type' })
  metricType?: string;

  @IsOptional()
  @IsEnum(ConfidenceLevel)
  @ApiPropertyOptional({ description: 'Filter by confidence level', enum: Object.values(ConfidenceLevel) })
  confidenceLevel?: ConfidenceLevel;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ description: 'Filter by notification status' })
  notified?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ description: 'Filter by acknowledgment status' })
  acknowledged?: boolean;

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
