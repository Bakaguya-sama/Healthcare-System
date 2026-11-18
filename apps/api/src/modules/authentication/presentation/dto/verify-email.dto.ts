import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class VerifyEmailDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() otpCode!: string;
}
