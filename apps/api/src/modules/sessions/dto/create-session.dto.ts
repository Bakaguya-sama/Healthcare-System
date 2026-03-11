import {
  IsMongoId,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiProperty({ example: '60d21b4667d0d8992e610c85' })
  @IsMongoId()
  doctorId: string;

  @ApiProperty({ example: '2026-03-15T09:00:00Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({ example: 30, description: 'Duration in minutes' })
  @IsNumber()
  @Min(15)
  duration: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
