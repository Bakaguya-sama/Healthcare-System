import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateConsultationDto {
  @ApiProperty({ example: '65e456def789abc012345678' })
  @IsMongoId()
  doctorId!: string;

  @ApiProperty({ required: false, example: '2026-10-20T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  scheduledStartAt?: string;

  @ApiProperty({ required: false, default: 30, minimum: 5, maximum: 180 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(180)
  expectedDurationMinutes?: number;

  @ApiProperty({
    required: false,
    example: 'I need advice about recurring headaches.',
  })
  @IsOptional()
  @IsString()
  patientNotes?: string;
}
