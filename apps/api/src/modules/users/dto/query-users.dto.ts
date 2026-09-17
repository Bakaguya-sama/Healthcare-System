import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PageSortQueryDto } from '../../../common/pagination';
import { AccountStatus, UserRole } from '../../../core/domain/user.enums';

export class QueryUsersDto extends PageSortQueryDto {
  @IsOptional()
  @IsIn(Object.values(UserRole))
  role?: UserRole;

  @IsOptional()
  @IsIn(Object.values(AccountStatus))
  accountStatus?: AccountStatus;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  search?: string;
}
