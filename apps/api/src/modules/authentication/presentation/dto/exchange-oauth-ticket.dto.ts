import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ExchangeOAuthTicketDto {
  @ApiProperty({ description: 'One-time opaque ticket issued by Google OAuth callback' })
  @IsString()
  @IsNotEmpty()
  ticket!: string;
}

