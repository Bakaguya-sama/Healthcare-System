import {
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsMongoId,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LimitQueryDto, PageSortQueryDto } from '../../../../common/pagination';

export const REVIEW_SORT_FIELDS = ['createdAt', 'rating'] as const;
export type ReviewSortField = (typeof REVIEW_SORT_FIELDS)[number];

export class QueryReviewDto extends PageSortQueryDto {
  @ApiProperty({
    required: false,
    description: 'Opaque cursor for doctor review history',
  })
  @IsOptional()
  cursor?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  consultationId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  patientId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  doctorId?: string;

  @ApiProperty({ example: 5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiProperty({ enum: REVIEW_SORT_FIELDS, required: false })
  @IsOptional()
  @IsIn(REVIEW_SORT_FIELDS)
  sortBy: ReviewSortField = 'createdAt';
}

export class QueryTopDoctorsDto extends LimitQueryDto {
  limit: number = 10;
}
