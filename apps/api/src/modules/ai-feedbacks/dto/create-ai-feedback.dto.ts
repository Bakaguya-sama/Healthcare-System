import {
  IsString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAiFeedbackDto {
  @ApiProperty({ description: 'AI Session ID', example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty()
  @IsString()
  aiSessionId: string;

  @ApiProperty({ description: 'Feedback content' })
  @IsNotEmpty()
  @IsString()
  content: string;
}

export class UpdateAiFeedbackDto {
  @ApiProperty({ description: 'Feedback content', required: false })
  @IsOptional()
  @IsString()
  content?: string;
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
  aiSessionId?: string;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiProperty({ required: false, description: 'Sort order: 1 or -1' })
  @IsOptional()
  sortOrder?: number = -1;
}
