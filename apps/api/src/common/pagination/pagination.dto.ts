import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from './pagination.constants';
import { SortDirection } from './pagination.types';

function normalizeSortDirection(value: unknown): unknown {
  if (value === 1 || value === '1' || value === SortDirection.ASC) {
    return 1;
  }

  if (value === -1 || value === '-1' || value === SortDirection.DESC) {
    return -1;
  }

  return value;
}

export class PageQueryDto {
  @ApiPropertyOptional({ default: DEFAULT_PAGE, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_PAGE;

  @ApiPropertyOptional({
    default: DEFAULT_PAGE_LIMIT,
    minimum: 1,
    maximum: MAX_PAGE_LIMIT,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit: number = DEFAULT_PAGE_LIMIT;
}

export class CursorQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor returned by the previous response',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    default: DEFAULT_PAGE_LIMIT,
    minimum: 1,
    maximum: MAX_PAGE_LIMIT,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit: number = DEFAULT_PAGE_LIMIT;
}

export class LimitQueryDto {
  @ApiPropertyOptional({
    default: DEFAULT_PAGE_LIMIT,
    minimum: 1,
    maximum: MAX_PAGE_LIMIT,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit: number = DEFAULT_PAGE_LIMIT;
}

export class SortQueryDto {
  @ApiPropertyOptional({ enum: [-1, 1], default: -1 })
  @Transform(({ value }) => normalizeSortDirection(value))
  @IsIn([-1, 1])
  sortOrder: 1 | -1 = -1;
}

export class PageSortQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: [-1, 1], default: -1 })
  @Transform(({ value }) => normalizeSortDirection(value))
  @IsIn([-1, 1])
  sortOrder: 1 | -1 = -1;
}

export class CursorSortQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: [-1, 1], default: -1 })
  @Transform(({ value }) => normalizeSortDirection(value))
  @IsIn([-1, 1])
  sortOrder: 1 | -1 = -1;
}
