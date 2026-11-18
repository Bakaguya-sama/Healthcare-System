import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

/** Credential-gated restore of a rejected Doctor's prior application. */
export class RestoreDoctorReapplicationDto {
  @ApiProperty({ example: 'doctor@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(12)
  password!: string;
}
