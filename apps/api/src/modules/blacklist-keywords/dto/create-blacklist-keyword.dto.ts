import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBlacklistKeywordDto {
  @ApiProperty({ description: 'Array of keywords/phrases to block', type: [String] })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  word_list: string[];
}

export class UpdateBlacklistKeywordDto {
  @ApiProperty({ description: 'Array of keywords/phrases to block', type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  word_list?: string[];
}

export class QueryBlacklistKeywordDto {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  limit?: number = 10;

  @ApiProperty({ required: false, description: 'Search by keyword' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiProperty({ required: false, description: 'Sort order: 1 or -1' })
  @IsOptional()
  sortOrder?: number = -1;
}
