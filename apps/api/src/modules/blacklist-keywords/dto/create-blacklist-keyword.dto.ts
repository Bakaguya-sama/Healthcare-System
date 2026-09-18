import { IsString, IsNotEmpty, IsOptional, IsIn, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PageSortQueryDto } from '../../../common/pagination';

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

export class QueryBlacklistKeywordDto extends PageSortQueryDto {
  @ApiProperty({ required: false, description: 'Search by keyword' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  @IsIn(['createdAt', 'keyword'])
  sortBy?: 'createdAt' | 'keyword' = 'createdAt';
}
