import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  IsObject,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAiDocumentChunkDto {
  @ApiProperty({ description: 'Document ID', example: '507f1f77bcf86cd799439011' })
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

export class QueryAiDocumentChunkDto {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  page: number = 1;

  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  limit: number = 10;

  @ApiProperty({ required: false, description: 'Filter by document ID' })
  @IsOptional()
  documentId?: string;

  @ApiProperty({ required: false, description: 'Search in content' })
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  sortBy?: string = 'chunkIndex';

  @ApiProperty({ required: false, description: 'Sort order: 1 or -1' })
  @IsOptional()
  sortOrder?: number = 1;
}
