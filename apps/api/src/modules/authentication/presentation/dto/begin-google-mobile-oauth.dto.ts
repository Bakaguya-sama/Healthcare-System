import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class BeginGoogleMobileOAuthDto {
  @ApiProperty({
    description: 'Base64url SHA-256 challenge of an app-generated RFC 7636 verifier',
    example: 'uD9_RuTUk2cZV7j5C2j2eU_sx0eJ9gUu2hC8O2I2aX4',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  challenge!: string;
}
