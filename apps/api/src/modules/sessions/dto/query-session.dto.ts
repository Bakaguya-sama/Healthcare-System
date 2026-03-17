import {
  IsEnum,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { SessionStatus, SessionType } from '../entities/session.entity';

export class QuerySessionDto {
  @ApiProperty({ enum: SessionStatus, required: false })
  @IsEnum(SessionStatus)
  @IsOptional()
  status?: SessionStatus;

  @ApiProperty({ enum: SessionType, required: false })
  @IsEnum(SessionType)
  @IsOptional()
  type?: SessionType;

  @ApiProperty({ example: '65e456def789abc012345678', required: false })
  @IsOptional()
  doctorId?: string;

  @ApiProperty({ example: '65e789ghi012jkl345678901', required: false })
  @IsOptional()
  patientId?: string;

  @ApiProperty({ example: '2026-03-01T00:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: '2026-03-31T23:59:59Z', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: 1, default: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @ApiProperty({ example: 10, default: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiProperty({ example: 'scheduledAt', required: false })
  @IsOptional()
  sortBy?: string = 'scheduledAt';

  @ApiProperty({ example: '-1', required: false })
  @Type(() => Number)
  @IsOptional()
  sortOrder?: 1 | -1 = -1;
}
