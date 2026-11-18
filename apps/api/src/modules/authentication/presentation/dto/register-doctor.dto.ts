import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class RegisterDoctorDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(12) password!: string;
  @ApiProperty() @IsString() @IsNotEmpty() fullName!: string;
  @ApiProperty() @IsString() @IsNotEmpty() specialty!: string;
  @ApiProperty() @IsString() @IsNotEmpty() workplace!: string;
  @ApiProperty() @IsInt() @Min(0) experienceYears!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() phoneNumber?: string;
}
