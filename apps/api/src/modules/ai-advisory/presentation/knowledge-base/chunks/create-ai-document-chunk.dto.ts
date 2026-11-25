import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  IsObject,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PageSortQueryDto } from '../../../../../common/pagination';

export class CreateAiDocumentChunkDto {
  @ApiProperty({
    description: 'Document ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsNotEmpty()
  @IsString()
  documentId: string;

  @ApiProperty({ description: 'Chunk content' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({ description: 'Chunk index/sequence' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  chunkIndex: number;

  @ApiProperty({ description: 'Embedding vector', required: false })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  embedding?: number[];

  @ApiProperty({ description: 'Token count', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tokenCount?: number;

  @ApiProperty({ description: 'Metadata', required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Related chunk IDs', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedChunks?: string[];
}

export class UpdateAiDocumentChunkDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  embedding?: number[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedChunks?: string[];
}

export class QueryAiDocumentChunkDto extends PageSortQueryDto {
  @ApiProperty({ required: false, description: 'Filter by document ID' })
  @IsOptional()
  documentId?: string;

  @ApiProperty({ required: false, description: 'Search in content' })
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  @IsIn(['chunkIndex', 'createdAt'])
  sortBy?: 'chunkIndex' | 'createdAt' = 'chunkIndex';

  sortOrder: 1 | -1 = 1;
}
