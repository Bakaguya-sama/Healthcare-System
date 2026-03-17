import {
  IsString,
  IsOptional,
  IsUrl,
  IsPhoneNumber,
  IsDateString,
  IsArray,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ required: false, description: 'Doctor only: specialization' })
  @IsOptional()
  @IsString()
  specialization?: string;

  @ApiProperty({
    required: false,
    description: 'Doctor only: workplace location',
  })
  @IsOptional()
  @IsString()
  workplace?: string;

  @ApiProperty({
    required: false,
    description: 'Doctor only: array of verification document URLs',
    example: [
      'https://example.com/cert1.pdf',
      'https://example.com/cert2.pdf',
    ],
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  verificationDocuments?: string[];

  @ApiProperty({
    required: false,
    description: 'Doctor only: years of experience',
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  experienceYears?: number;

  @ApiProperty({
    required: false,
    description: 'Doctor only: average rating (0-5)',
    example: 4.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  averageRating?: number;

  @ApiProperty({
    required: false,
    description: 'Doctor only: online status',
  })
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;
}
