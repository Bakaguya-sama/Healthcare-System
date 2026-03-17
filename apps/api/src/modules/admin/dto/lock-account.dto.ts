import { IsString, MaxLength } from 'class-validator';

export class LockAccountDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}
