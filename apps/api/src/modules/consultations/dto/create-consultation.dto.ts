import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateConsultationDto {
  @ApiProperty({ example: '65e456def789abc012345678' })
  @IsMongoId()
  doctorId!: string;

  @ApiProperty({ required: false, example: '2026-10-20T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  scheduledStartAt?: string;

  @ApiProperty({
    required: false,
    example: 'I need advice about recurring headaches.',
  })
  @IsOptional()
  @IsString()
  patientNotes?: string;
}
