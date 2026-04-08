import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsEmail,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '../entities/admin.entity';
import { AccountStatus } from '../../auth/entities/user.schema';

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
    enum: AdminRole,
    default: AdminRole.USER_ADMIN,
    description: 'Admin role/permission level',
  })
  @IsOptional()
  @IsEnum(AdminRole)
  assignedRole?: AdminRole;

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
    enum: AdminRole,
    required: false,
  })
  @IsOptional()
  @IsEnum(AdminRole)
  adminRole?: AdminRole;
}

export class QueryAdminDto {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  page: number = 1;

  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  limit: number = 10;

  @ApiProperty({
    enum: AdminRole,
    required: false,
    description: 'Filter by admin role',
  })
  @IsOptional()
  adminRole?: AdminRole;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  sortBy?: string;

  @ApiProperty({ required: false, description: 'Sort order: 1 or -1' })
  @IsOptional()
  sortOrder?: number;
}
