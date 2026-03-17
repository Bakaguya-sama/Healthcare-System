import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  IsUrl,
  Min,
  IsObject,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentType, DocumentStatus } from '../entities/ai-document.entity';

export class CreateAiDocumentDto {
  @ApiProperty({ description: 'Document title' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Document description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Original file name' })
  @IsNotEmpty()
  @IsString()
  fileName: string;

  @ApiProperty({ description: 'Document type', enum: Object.values(DocumentType) })
  @IsNotEmpty()
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({ description: 'S3/Cloud storage URL' })
  @IsNotEmpty()
  @IsUrl()
  fileUrl: string;

  @ApiProperty({ description: 'File size in bytes' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  fileSize: number;

  @ApiProperty({ description: 'MIME type', required: false })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiProperty({ description: 'Tags for categorization', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ description: 'Related document IDs', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedDocuments?: string[];

  @ApiProperty({ description: 'Metadata', required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateAiDocumentDto {
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
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedDocuments?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
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
    enum: Object.values(DocumentType),
    description: 'Filter by document type',
  })
  @IsOptional()
  documentType?: DocumentType;

  @ApiProperty({
    required: false,
    enum: Object.values(DocumentStatus),
    description: 'Filter by status',
  })
  @IsOptional()
  status?: DocumentStatus;

  @ApiProperty({ required: false, description: 'Search by title/description' })
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, description: 'Filter by tag' })
  @IsOptional()
  tag?: string;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiProperty({ required: false, description: 'Sort order: 1 or -1' })
  @IsOptional()
  sortOrder?: number = -1;
}
