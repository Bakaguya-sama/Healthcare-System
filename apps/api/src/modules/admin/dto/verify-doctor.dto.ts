import { IsString, IsOptional, MaxLength } from 'class-validator';

export class VerifyDoctorDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  verificationNotes?: string;
}
