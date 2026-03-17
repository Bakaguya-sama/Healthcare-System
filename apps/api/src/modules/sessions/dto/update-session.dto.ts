import { PartialType } from '@nestjs/mapped-types';
import { CreateSessionDto } from './create-session.dto';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus } from '../entities/session.entity';

export class UpdateSessionDto extends PartialType(CreateSessionDto) {
  @ApiProperty({ enum: SessionStatus, required: false })
  @IsEnum(SessionStatus)
  @IsOptional()
  status?: SessionStatus;

  @ApiProperty({ example: 'https://zoom.us/j/123456', required: false })
  @IsString()
  @IsOptional()
  meetingUrl?: string;

  @ApiProperty({ example: 'Prescribed antibiotics', required: false })
  @IsString()
  @IsOptional()
  prescription?: string;

  @ApiProperty({ example: 'Patient has fever and cough', required: false })
  @IsString()
  @IsOptional()
  diagnosis?: string;

  @ApiProperty({ example: 'Patient requested to reschedule', required: false })
  @IsString()
  @IsOptional()
  cancelReason?: string;
}
