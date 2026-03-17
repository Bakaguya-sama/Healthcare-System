import { PartialType } from '@nestjs/mapped-types';
import { CreateReviewDto } from './create-review.dto';
import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReviewStatus } from '../entities/review.entity';

export class UpdateReviewDto extends PartialType(CreateReviewDto) {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({
    enum: ReviewStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;
}
