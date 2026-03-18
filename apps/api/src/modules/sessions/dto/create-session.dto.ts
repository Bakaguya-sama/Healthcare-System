import {
  IsMongoId,
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiProperty({ example: '65e456def789abc012345678' })
  @IsMongoId()
  doctorId: string;

  @ApiProperty({ example: '2026-03-20T10:00:00Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({ example: 'Initial notes', required: false })
  @IsString()
  @IsOptional()
  patientNotes?: string;
}
