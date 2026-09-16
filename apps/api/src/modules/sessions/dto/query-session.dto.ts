import {
  IsEnum,
  IsOptional,
  IsDateString,
  IsIn,
  IsMongoId,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus } from '../entities/session.entity';
import { PageSortQueryDto } from '../../../common/pagination';

export const SESSION_SORT_FIELDS = [
  'scheduledAt',
  'createdAt',
  'updatedAt',
] as const;
export type SessionSortField = (typeof SESSION_SORT_FIELDS)[number];

export class QuerySessionDto extends PageSortQueryDto {
  @ApiProperty({ enum: SessionStatus, required: false })
  @IsEnum(SessionStatus)
  @IsOptional()
  status?: SessionStatus;

  @ApiProperty({ example: '65e456def789abc012345678', required: false })
  @IsOptional()
  @IsMongoId()
  doctorId?: string;

  @ApiProperty({ example: '65e789ghi012jkl345678901', required: false })
  @IsOptional()
  @IsMongoId()
  patientId?: string;

  @ApiProperty({ example: '2026-03-01T00:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: '2026-03-31T23:59:59Z', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ enum: SESSION_SORT_FIELDS, required: false })
  @IsOptional()
  @IsIn(SESSION_SORT_FIELDS)
  sortBy: SessionSortField = 'scheduledAt';
}
