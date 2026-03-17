import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  Min,
  IsObject,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus, SessionType } from '../entities/ai-session.entity';
import { Types } from 'mongoose';

export class CreateAiSessionDto {
  @ApiProperty({ description: 'Session type', enum: Object.values(SessionType) })
  @IsNotEmpty()
  @IsEnum(SessionType)
  sessionType: SessionType;

  @ApiProperty({ description: 'Session title', example: 'Diabetes consultation' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Session description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Initial problem statement' })
  @IsNotEmpty()
  @IsString()
  initialProblem: string;
}

export class UpdateAiSessionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  keyFindings?: Record<string, any>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  recommendations?: Record<string, any>;
}

export class QueryAiSessionDto {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  page: number = 1;

  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  limit: number = 10;

  @ApiProperty({
    required: false,
    enum: Object.values(SessionStatus),
    description: 'Filter by status',
  })
  @IsOptional()
  status?: SessionStatus;

  @ApiProperty({
    required: false,
    enum: Object.values(SessionType),
    description: 'Filter by session type',
  })
  @IsOptional()
  sessionType?: SessionType;

  @ApiProperty({ required: false, description: 'Search by title' })
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  sortBy?: string;

  @ApiProperty({ required: false, description: 'Sort order: 1 or -1' })
  @IsOptional()
  sortOrder?: number = -1;
}
