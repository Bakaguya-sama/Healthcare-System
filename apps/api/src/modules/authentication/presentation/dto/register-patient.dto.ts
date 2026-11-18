import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class RegisterPatientDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(12) password!: string;
  @ApiProperty() @IsString() @IsNotEmpty() fullName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phoneNumber?: string;
}
