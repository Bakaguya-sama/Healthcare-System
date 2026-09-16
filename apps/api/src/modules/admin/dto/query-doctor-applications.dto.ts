import { IsIn, IsOptional, IsString } from 'class-validator';
import { DoctorVerificationStatus } from '../../users/entities/doctor.schema';
import { PageQueryDto } from '../../../common/pagination';

export class QueryDoctorApplicationsDto extends PageQueryDto {
  @IsOptional()
  @IsIn([
    DoctorVerificationStatus.PENDING,
    DoctorVerificationStatus.APPROVED,
    DoctorVerificationStatus.REJECTED,
  ])
  status?: DoctorVerificationStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
