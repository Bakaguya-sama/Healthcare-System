import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PageSortQueryDto } from '../../../common/pagination';

export class CreatePatientDto {
  // Empty - Patient only has userId from auth, no additional fields needed
}

export class UpdatePatientDto {
  // Empty - Patient profile is read-only in template
}

export class QueryPatientDto extends PageSortQueryDto {
  @ApiProperty({
    required: false,
    enum: ['active', 'inactive'],
    description: 'Filter by status',
  })
  @IsOptional()
  status?: string;

  @ApiProperty({ required: false, description: 'Search by name' })
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt'])
  sortBy?: 'createdAt' | 'updatedAt' = 'createdAt';
}
