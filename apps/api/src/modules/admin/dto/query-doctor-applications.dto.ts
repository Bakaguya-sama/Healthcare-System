import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { DoctorVerificationStatus } from '../../users/entities/doctor.schema';

export class QueryDoctorApplicationsDto {
  @IsOptional()
  @IsIn([
    DoctorVerificationStatus.PENDING,
    DoctorVerificationStatus.APPROVED,
    DoctorVerificationStatus.REJECTED,
  ])
  status?: DoctorVerificationStatus;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
