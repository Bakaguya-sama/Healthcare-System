import { PartialType } from '@nestjs/mapped-types';
import { CreateSessionDto } from './create-session.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus } from '../entities/session.entity';

export class UpdateSessionDto extends PartialType(CreateSessionDto) {
  @ApiProperty({ enum: SessionStatus, required: false })
  @IsEnum(SessionStatus)
  @IsOptional()
  status?: SessionStatus;

  @ApiProperty({ example: 'Doctor notes here', required: false })
  @IsString()
  @IsOptional()
  doctorNotes?: string;
}
