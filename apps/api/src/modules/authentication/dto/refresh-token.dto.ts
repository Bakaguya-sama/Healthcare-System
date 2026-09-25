import { IsString, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ example: 'user_id_here' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 'refresh_token_here' })
  @IsString()
  refreshToken: string;
}
