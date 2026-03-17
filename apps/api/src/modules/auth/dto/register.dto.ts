import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/enums/user-role.enum';
import { Type } from 'class-transformer';

export class AddressDto {
  @ApiProperty({ example: '123 Nguyen Hue' })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiProperty({ example: 'Ward 1' })
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiProperty({ example: 'District 1' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ example: 'Ho Chi Minh' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ example: 'Vietnam' })
  @IsOptional()
  @IsString()
  country?: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ enum: UserRole, default: UserRole.PATIENT, required: false })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({ example: 'male', required: false })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({ example: '+84912345678', required: false })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ type: AddressDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}
