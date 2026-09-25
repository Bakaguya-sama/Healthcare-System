import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsEmail,
  MinLength,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AccountStatus } from '../../../../core/domain/user.enums';
import { PageSortQueryDto } from '../../../../common/pagination';

export enum AdminApiRole {
  SUPER_ADMIN = 'super_admin',
  USER_ADMIN = 'user_admin',
  AI_ADMIN = 'ai_admin',
}

export class CreateAdminDto {
  @ApiProperty({ example: 'Alex Rivera' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'admin@healthcare.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    enum: AdminApiRole,
    default: AdminApiRole.USER_ADMIN,
    description: 'Admin role/permission level',
  })
  @IsOptional()
  @IsEnum(AdminApiRole)
  assignedRole?: AdminApiRole;

  @ApiProperty({
    enum: AccountStatus,
    required: false,
    default: AccountStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(AccountStatus)
  accountStatus?: AccountStatus;
}

export class UpdateAdminDto {
  @ApiProperty({
    enum: AdminApiRole,
    required: false,
  })
  @IsOptional()
  @IsEnum(AdminApiRole)
  adminRole?: AdminApiRole;
}

export class QueryAdminDto extends PageSortQueryDto {
  @ApiProperty({
    enum: AdminApiRole,
    required: false,
    description: 'Filter by admin role',
  })
  @IsOptional()
  adminRole?: AdminApiRole;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'adminRole'])
  sortBy?: 'createdAt' | 'updatedAt' | 'adminRole' = 'createdAt';
}
