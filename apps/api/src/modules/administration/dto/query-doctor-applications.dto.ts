import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DoctorVerificationStatus } from '../../../core/domain/user.enums';
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
  @MinLength(2)
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
