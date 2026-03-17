import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePatientProfileDto {
  @ApiProperty({ description: 'Date of birth', example: '1990-01-01', required: false })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiProperty({ description: 'Blood type', example: 'O+', required: false })
  @IsString()
  @IsOptional()
  bloodType?: string;

  @ApiProperty({ description: 'Allergies', example: 'Penicillin', required: false })
  @IsString()
  @IsOptional()
  allergies?: string;

  @ApiProperty({ description: 'Medical history notes', required: false })
  @IsString()
  @IsOptional()
  medicalHistory?: string;

  @ApiProperty({ description: 'Emergency contact phone', required: false })
  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;
}
