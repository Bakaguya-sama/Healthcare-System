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
import { IsCloudinaryUrl } from '../../../core/validators/is-cloudinary-url.validator';

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({
    required: false,
    description:
      '🌥️ Cloudinary URL only. Upload via POST /upload/single first, then use returned URL here',
    example: 'https://res.cloudinary.com/healthcare/image/upload/...',
  })
  @IsOptional()
  @IsCloudinaryUrl()
  avatarUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ required: false, description: 'Doctor only: specialty' })
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiProperty({
    required: false,
    description: 'Doctor only: workplace location',
  })
  @IsOptional()
  @IsString()
  workplace?: string;

  @ApiProperty({
    required: false,
    description:
      '🔒 Doctor only: Array of Cloudinary URLs (max 5 documents). Upload via POST /upload/multiple first, then use returned URLs here',
    example: [
      'https://res.cloudinary.com/healthcare/raw/upload/healthcare/doctors/verification/cert1.pdf',
      'https://res.cloudinary.com/healthcare/raw/upload/healthcare/doctors/verification/cert2.pdf',
    ],
  })
  @IsOptional()
  @IsArray()
  @IsCloudinaryUrl({ each: true })
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
