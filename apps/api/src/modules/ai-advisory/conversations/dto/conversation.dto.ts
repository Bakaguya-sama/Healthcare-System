import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  MaxLength,
  MinLength,
  IsEnum,
  IsMongoId,
  IsObject,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ConversationType } from '../entities/ai-conversation.entity';
import { PageSortQueryDto } from '../../../../common/pagination';

export class StartConversationDto {
  @ApiProperty({
    example: 'health_inquiry',
    description: 'Type of conversation',
  })
  @IsOptional()
  @IsEnum(ConversationType)
  type?: ConversationType;

  @ApiProperty({
    example: 'Tôi bị đau đầu 3 ngày liên tiếp',
    description: 'Initial question or topic',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  initialQuestion: string;

  @ApiProperty({ required: false, example: ['headache', 'pain'] })
  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class AiSendMessageDto {
  @ApiProperty({
    example: 'Huyết áp 140/90 có nguy hiểm không?',
    description:
      'Message content to send to AI (optional if image is provided)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiProperty({ required: false, example: 'symptom_analysis' })
  @IsOptional()
  @IsEnum(ConversationType)
  conversationType?: ConversationType;
}

export class RateConversationDto {
  @ApiProperty({
    example: 5,
    description: 'Rating from 1 to 5',
    minimum: 1,
    maximum: 5,
  })
  @IsNotEmpty()
  rating: number;

  @ApiProperty({ example: 'Very helpful and informative', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class ArchiveConversationDto {
  @ApiProperty({ example: false, description: 'Archive or unarchive' })
  @IsNotEmpty()
  isArchived: boolean;
}

export class UpdateConversationDto {
  @ApiProperty({ example: 'Updated topic', required: false })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiProperty({
    example: 'Internal note about this conversation',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  internalNotes?: string;

  @ApiProperty({ example: ['urgent', 'follow-up'], required: false })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiProperty({ example: 'active', required: false })
  @IsOptional()
  status?: 'draft' | 'active' | 'completed' | 'archived';
}

export class QueryConversationDto extends PageSortQueryDto {
  @ApiProperty({
    required: false,
    description: 'Opaque cursor for conversation history',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(ConversationType)
  type?: ConversationType;

  @ApiProperty({ required: false })
  @IsOptional()
  status?: 'draft' | 'active' | 'completed' | 'archived';

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  isFavorite?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  isArchived?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'lastMessageAt'])
  sortBy: 'createdAt' | 'updatedAt' | 'lastMessageAt' = 'createdAt';

  @ApiProperty({ required: false })
  @IsOptional()
  startDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  endDate?: Date;

  @ApiProperty({ example: 'health', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  searchQuery?: string;

  @ApiProperty({ example: ['urgent'], required: false })
  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class QueryConversationMessageDto extends PageSortQueryDto {
  @ApiProperty({
    required: false,
    description: 'Opaque cursor for embedded message history',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
  @ApiProperty({ example: '65e456def789abc012345678', required: false })
  @IsOptional()
  @IsMongoId()
  conversationId?: string;

  @ApiProperty({ enum: ['timestamp'], required: false })
  @IsOptional()
  @IsIn(['timestamp'])
  sortBy = 'timestamp' as const;
}

export class SearchConversationDto extends QueryConversationDto {
  @ApiProperty({ example: 'health' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q: string;
}

export class AiHealthProfileSummaryDto {
  @ApiProperty({
    required: true,
  })
  @IsOptional()
  @IsObject()
  patientProfile?: any;
}
