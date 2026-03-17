import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  IsBoolean,
  Min,
  IsObject,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MessageRole, MessageFeedback } from '../entities/ai-message.entity';
import { Types } from 'mongoose';

export class CreateAiMessageDto {
  @ApiProperty({ description: 'Session ID', example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty()
  @IsString()
  sessionId: string;

  @ApiProperty({ description: 'Message role', enum: Object.values(MessageRole) })
  @IsNotEmpty()
  @IsEnum(MessageRole)
  role: MessageRole;

  @ApiProperty({ description: 'Message content' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({ description: 'Metadata', required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Array of attachments', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @ApiProperty({ description: 'Token count', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tokenCount?: number;
}

export class UpdateAiMessageDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(MessageFeedback)
  feedback?: MessageFeedback;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  feedbackNotes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isFlagged?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  flagReason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  citations?: Record<string, any>;
}

export class QueryAiMessageDto {
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
    enum: Object.values(MessageRole),
    description: 'Filter by role',
  })
  @IsOptional()
  role?: MessageRole;

  @ApiProperty({
    required: false,
    enum: Object.values(MessageFeedback),
    description: 'Filter by feedback',
  })
  @IsOptional()
  feedback?: MessageFeedback;

  @ApiProperty({
    required: false,
    description: 'Filter flagged messages',
  })
  @IsOptional()
  isFlagged?: boolean;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiProperty({ required: false, description: 'Sort order: 1 or -1' })
  @IsOptional()
  sortOrder?: number = -1;
}
