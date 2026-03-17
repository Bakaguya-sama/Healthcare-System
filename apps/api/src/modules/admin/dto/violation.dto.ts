import { IsString, IsOptional, MaxLength, IsEnum, IsNumberString } from 'class-validator';
import { ViolationType, ViolationStatus } from '../entities/violation-report.entity';

export class CreateViolationDto {
  @IsString()
  @MaxLength(1000)
  reason: string;

  @IsEnum(ViolationType)
  type: ViolationType;

  @IsString()
  @IsOptional()
  evidence?: string;

  @IsString()
  reportedUserId: string;
}

export class QueryViolationDto {
  @IsNumberString()
  page?: number = 1;

  @IsNumberString()
  limit?: number = 10;

  @IsEnum(ViolationStatus)
  @IsOptional()
  status?: ViolationStatus;

  @IsEnum(ViolationType)
  @IsOptional()
  type?: ViolationType;

  @IsOptional()
  sortBy?: string = 'createdAt';

  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class AddViolationNoteDto {
  @IsString()
  @MaxLength(500)
  note: string;
}

export class ResolveViolationDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  resolution?: string;
}
