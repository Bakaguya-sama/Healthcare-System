import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PageSortQueryDto } from '../../../../common/pagination';

export class QueryDoctorsDto extends PageSortQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  specialty?: string;
}
