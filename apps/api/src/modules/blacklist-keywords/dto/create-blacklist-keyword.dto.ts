import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBlacklistKeywordDto {
  @ApiProperty({ description: 'Keyword/phrase to block' })
  @IsNotEmpty()
  @IsString()
  keyword: string;
}

export class UpdateBlacklistKeywordDto {
  @ApiProperty({ description: 'Keyword/phrase to block', required: false })
  @IsOptional()
  @IsString()
  keyword?: string;
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
