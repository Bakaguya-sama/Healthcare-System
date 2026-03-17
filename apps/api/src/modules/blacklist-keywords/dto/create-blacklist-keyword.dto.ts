import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { KeywordCategory, KeywordSeverity } from '../entities/blacklist-keyword.entity';

export class CreateBlacklistKeywordDto {
  @ApiProperty({ description: 'Keyword or phrase to block' })
  @IsNotEmpty()
  @IsString()
  keyword: string;

  @ApiProperty({ description: 'Category', enum: Object.values(KeywordCategory) })
  @IsNotEmpty()
  @IsEnum(KeywordCategory)
  category: KeywordCategory;

  @ApiProperty({ description: 'Severity level', enum: Object.values(KeywordSeverity), required: false })
  @IsOptional()
  @IsEnum(KeywordSeverity)
  severity?: KeywordSeverity;

  @ApiProperty({ description: 'Reason for blocking', required: false })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ description: 'Exact match only', required: false })
  @IsOptional()
  @IsBoolean()
  exactMatch?: boolean;

  @ApiProperty({ description: 'Case insensitive', required: false })
  @IsOptional()
  @IsBoolean()
  caseInsensitive?: boolean;

  @ApiProperty({ description: 'Regex patterns', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  patterns?: string[];
}

export class UpdateBlacklistKeywordDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(KeywordCategory)
  category?: KeywordCategory;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(KeywordSeverity)
  severity?: KeywordSeverity;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  exactMatch?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  caseInsensitive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  patterns?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryBlacklistKeywordDto {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  page: number = 1;

  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  limit: number = 10;

  @ApiProperty({
    required: false,
    enum: Object.values(KeywordCategory),
    description: 'Filter by category',
  })
  @IsOptional()
  category?: KeywordCategory;

  @ApiProperty({
    required: false,
    enum: Object.values(KeywordSeverity),
    description: 'Filter by severity',
  })
  @IsOptional()
  severity?: KeywordSeverity;

  @ApiProperty({
    required: false,
    description: 'Filter active keywords',
  })
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false, description: 'Search by keyword' })
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiProperty({ required: false, description: 'Sort order: 1 or -1' })
  @IsOptional()
  sortOrder?: number = -1;
}
