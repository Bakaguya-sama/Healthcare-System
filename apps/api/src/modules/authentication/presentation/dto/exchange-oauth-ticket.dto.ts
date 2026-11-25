import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class ExchangeOAuthTicketDto {
  @ApiProperty({ description: 'Backend-generated mobile OAuth attempt ID' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  attemptId!: string;

  @ApiProperty({ description: 'One-time opaque ticket issued by Google OAuth callback' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  ticket!: string;

  @ApiProperty({ description: 'App-generated RFC 7636 verifier; never put it in a URL' })
  @IsString()
  @Matches(/^[A-Za-z0-9._~-]{43,128}$/)
  verifier!: string;
}

