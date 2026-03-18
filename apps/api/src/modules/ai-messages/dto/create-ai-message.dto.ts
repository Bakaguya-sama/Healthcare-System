import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Types } from 'mongoose';

export class CreateAiMessageDto {
  @ApiProperty({ description: 'AI Session ID', example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty()
  @IsString()
  aiSessionId: string;

  @ApiProperty({ description: 'Sender type', enum: ['user', 'assistant', 'system'] })
  @IsNotEmpty()
  @IsString()
  senderType: 'user' | 'assistant' | 'system';

  @ApiProperty({ description: 'Message content' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({ description: 'Array of attachment URLs', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

export class UpdateAiMessageDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  content?: string;
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
  aiSessionId?: string;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  sortBy?: string = 'sentAt';

  @ApiProperty({ required: false, description: 'Sort order: 1 or -1' })
  @IsOptional()
  sortOrder?: number = -1;
}
