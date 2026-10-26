import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateConsultationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  patientNotes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  doctorNotes?: string;

  @ApiProperty({ required: false, example: '2026-10-20T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  scheduledStartAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
