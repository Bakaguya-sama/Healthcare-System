import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyDoctorDto {
  @ApiProperty({
    description: 'Verification notes from admin',
    required: false,
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  verificationNotes?: string;
}
