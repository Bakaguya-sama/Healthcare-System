import {
  IsMongoId,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsArray,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { SessionType } from '../entities/session.entity';

export class CreateSessionDto {
  @ApiProperty({ example: '65e456def789abc012345678' })
  @IsMongoId()
  doctorId: string;

  @ApiProperty({ enum: SessionType, example: 'consultation' })
  @IsEnum(SessionType)
  type: SessionType;

  @ApiProperty({ example: 'Initial Consultation' })
  @IsString()
  @MinLength(3)
  title: string;

  @ApiProperty({ example: 'Patient complains about headaches' })
  @IsString()
  @MinLength(10)
  description: string;

  @ApiProperty({ example: '2026-03-20T10:00:00Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({ example: 30, required: false })
  @IsNumber()
  @Min(15)
  @IsOptional()
  duration?: number; // default 30 minutes

  @ApiProperty({ example: 'First time visiting', required: false })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({
    example: ['https://example.com/medical-record.pdf'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];
}
