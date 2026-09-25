import {
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PageSortQueryDto } from '../../../../common/pagination';

export class CreateAiFeedbackDto {
  @ApiProperty({
    description: 'AI conversation ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsNotEmpty()
  @IsMongoId()
  aiConversationId!: string;

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

export class QueryAiFeedbackDto extends PageSortQueryDto {
  @ApiProperty({ required: false, description: 'Filter by AI conversation ID' })
  @IsOptional()
  @IsMongoId()
  aiConversationId?: string;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt'])
  sortBy?: 'createdAt' | 'updatedAt' = 'createdAt';
}
