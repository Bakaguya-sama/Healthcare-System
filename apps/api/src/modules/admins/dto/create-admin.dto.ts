import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '../entities/admin.entity';

export class CreateAdminDto {
  @ApiProperty({
    description: 'Admin full name',
    example: 'Tran Thi Admin',
  })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({
    enum: AdminRole,
    default: AdminRole.USER_MANAGER,
    description: 'Admin role/permission level',
  })
  @IsOptional()
  @IsEnum(AdminRole)
  adminRole?: AdminRole;

  @ApiProperty({
    description: 'Department/division',
    example: 'User Management',
    required: false,
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({
    description: 'Additional fine-grained permissions',
    example: ['can_ban_users', 'can_approve_doctors'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class UpdateAdminDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({
    enum: AdminRole,
    required: false,
  })
  @IsOptional()
  @IsEnum(AdminRole)
  adminRole?: AdminRole;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
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

  @ApiProperty({
    required: false,
    description: 'Filter by active status',
  })
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  sortBy?: string;

  @ApiProperty({ required: false, description: 'Sort order: 1 or -1' })
  @IsOptional()
  sortOrder?: number;
}
