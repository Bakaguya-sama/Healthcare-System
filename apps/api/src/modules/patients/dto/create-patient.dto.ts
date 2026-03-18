import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsArray,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePatientDto {
  @ApiProperty({ description: 'Patient full name', example: 'Nguyen Van A' })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({
    description: 'Date of birth',
    example: '1990-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}

export class UpdatePatientDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}

export class QueryPatientDto {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  page: number = 1;

  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  limit: number = 10;

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
  sortBy?: string;

  @ApiProperty({ required: false, description: 'Sort order: 1 or -1' })
  @IsOptional()
  sortOrder?: number;
}
