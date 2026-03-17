import {
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  Max,
  IsMongoId,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReviewStatus, ReviewRating } from '../entities/review.entity';
import { Type } from 'class-transformer';

export class QueryReviewDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  patientId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  doctorId?: string;

  @ApiProperty({
    enum: ReviewStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  @ApiProperty({ example: 5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiProperty({ example: 1, required: false })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  page: number = 1;

  @ApiProperty({ example: 10, required: false })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiProperty({ example: 'createdAt', required: false })
  @IsOptional()
  sortBy: string = 'createdAt';

  @ApiProperty({ example: -1, required: false })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  sortOrder: -1 | 1 = -1;
}
