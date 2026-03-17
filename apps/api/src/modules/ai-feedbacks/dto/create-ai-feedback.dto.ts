import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FeedbackType } from '../entities/ai-feedback.entity';
import { Types } from 'mongoose';

export class CreateAiFeedbackDto {
  @ApiProperty({ description: 'Session ID', example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty()
  @IsString()
  sessionId: string;

  @ApiProperty({ description: 'Message ID', required: false })
  @IsOptional()
  @IsString()
  messageId?: string;

  @ApiProperty({ description: 'Feedback type', enum: Object.values(FeedbackType) })
  @IsNotEmpty()
  @IsEnum(FeedbackType)
  feedbackType: FeedbackType;

  @ApiProperty({ description: 'Rating 1-5', example: 5 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: 'Feedback comment', required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ description: 'Tags for feedback', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ description: 'Additional metadata', required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateAiFeedbackDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(FeedbackType)
  feedbackType?: FeedbackType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ required: false })
  @IsOptional()
  isVerified?: boolean;
}

export class QueryAiFeedbackDto {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  page: number = 1;

  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  limit: number = 10;

  @ApiProperty({ required: false, description: 'Filter by session ID' })
  @IsOptional()
  sessionId?: string;

  @ApiProperty({
    required: false,
    enum: Object.values(FeedbackType),
    description: 'Filter by feedback type',
  })
  @IsOptional()
  feedbackType?: FeedbackType;

  @ApiProperty({ required: false, description: 'Filter by minimum rating' })
  @IsOptional()
  minRating?: number;

  @ApiProperty({ required: false, description: 'Filter by maximum rating' })
  @IsOptional()
  maxRating?: number;

  @ApiProperty({
    required: false,
    description: 'Filter verified feedbacks',
  })
  @IsOptional()
  isVerified?: boolean;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiProperty({ required: false, description: 'Sort order: 1 or -1' })
  @IsOptional()
  sortOrder?: number = -1;
}
