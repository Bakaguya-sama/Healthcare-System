import {
  IsString,
  IsOptional,
  IsEnum,
  IsIn,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentStatus } from '../entities/ai-document.entity';
import { IsCloudinaryUrl } from '../../../../../core/validators/is-cloudinary-url.validator';
import { PageSortQueryDto } from '../../../../../common/pagination';

export class CreateAiDocumentDto {
  @ApiProperty({
    description:
      'Document title (optional). If omitted, backend uses original filename',
    required: false,
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    required: false,
    description: 'Optional UTC cutoff after which RAG must not retrieve it',
  })
  @IsOptional()
  @IsDateString()
  validUntil?: string | null;
}

export class UpdateAiDocumentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    required: false,
    description:
      '🌥️ Cloudinary URL only. Upload via POST /upload/single first, then use returned URL here',
    example:
      'https://res.cloudinary.com/healthcare/raw/upload/healthcare/ai/documents/guideline.pdf',
  })
  @IsOptional()
  @IsCloudinaryUrl()
  fileUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fileType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsDateString()
  validUntil?: string | null;
}

export class QueryAiDocumentDto extends PageSortQueryDto {
  @ApiProperty({
    required: false,
    enum: Object.values(DocumentStatus),
    description: 'Filter by status',
  })
  @IsOptional()
  status?: DocumentStatus;

  @ApiProperty({ required: false, description: 'Search by title' })
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'title'])
  sortBy?: 'createdAt' | 'updatedAt' | 'title' = 'createdAt';
}

export class TriggerRagIngestingDto {
  @ApiProperty({ required: true })
  @IsOptional()
  @IsString()
  id?: string;
}
