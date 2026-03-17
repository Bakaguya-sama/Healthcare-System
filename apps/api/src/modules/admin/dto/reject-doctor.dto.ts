import { IsString, MaxLength } from 'class-validator';

export class RejectDoctorDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}
