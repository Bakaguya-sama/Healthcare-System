import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsMongoId,
  IsOptional,
} from 'class-validator';
import { PageSortQueryDto } from '../../../common/pagination';
import {
  ConsultationMode,
  ConsultationRequestStatus,
  ConsultationSessionStatus,
} from '../entities/consultation.entity';

export const CONSULTATION_SORT_FIELDS = [
  'requestedAt',
  'scheduledStartAt',
  'createdAt',
  'updatedAt',
] as const;
export type ConsultationSortField = (typeof CONSULTATION_SORT_FIELDS)[number];

export class QueryConsultationDto extends PageSortQueryDto {
  @ApiProperty({ enum: ConsultationMode, required: false })
  @IsOptional()
  @IsEnum(ConsultationMode)
  mode?: ConsultationMode;

  @ApiProperty({ enum: ConsultationRequestStatus, required: false })
  @IsOptional()
  @IsEnum(ConsultationRequestStatus)
  requestStatus?: ConsultationRequestStatus;

  @ApiProperty({ enum: ConsultationSessionStatus, required: false })
  @IsOptional()
  @IsEnum(ConsultationSessionStatus)
  sessionStatus?: ConsultationSessionStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  doctorId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  patientId?: string;

  @ApiProperty({ required: false, example: '2026-10-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false, example: '2026-10-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiProperty({ enum: CONSULTATION_SORT_FIELDS, required: false })
  @IsOptional()
  @IsIn(CONSULTATION_SORT_FIELDS)
  sortBy: ConsultationSortField = 'requestedAt';
}
