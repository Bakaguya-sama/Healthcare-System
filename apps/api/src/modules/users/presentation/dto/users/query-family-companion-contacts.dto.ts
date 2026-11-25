import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { PageQueryDto } from '../../../../../common/pagination';

export class QueryFamilyCompanionContactsDto extends PageQueryDto {
  @ApiProperty({ minLength: 2, maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  search!: string;
}
