import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentStatus } from '../entities/ai-document.entity';

export class CreateAiDocumentDto {
  @ApiProperty({ description: 'Document title' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'S3/Cloud storage URL' })
  @IsNotEmpty()
  @IsString()
  fileUrl: string;

  @ApiProperty({ description: 'File type (pdf, docx, txt, etc)' })
  @IsNotEmpty()
  @IsString()
  fileType: string;
}

export class UpdateAiDocumentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fileType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}

export class QueryAiDocumentDto {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  page: number = 1;

  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  limit: number = 10;

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
  sortBy?: string = 'createdAt';

  @ApiProperty({ required: false, description: 'Sort order: 1 or -1' })
  @IsOptional()
  sortOrder?: number = -1;
}
