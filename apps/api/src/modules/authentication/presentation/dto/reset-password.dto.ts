import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class ResetPasswordDto { @ApiProperty() @IsEmail() email!: string; @ApiProperty() @IsString() otpCode!: string; @ApiProperty() @IsString() @MinLength(12) newPassword!: string; }
