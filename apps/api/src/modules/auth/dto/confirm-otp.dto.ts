import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  otpCode: string;

  @ApiProperty({ example: 'NewPass456!' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
