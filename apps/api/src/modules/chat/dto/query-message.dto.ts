import {
  IsOptional,
  IsMongoId,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QueryMessageDto {
  @ApiProperty({ example: '65e456def789abc012345678', required: false })
  @IsOptional()
  @IsMongoId()
  doctorSessionId?: string;

  @ApiProperty({ example: 1, required: false })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  page: number = 1;

  @ApiProperty({ example: 20, required: false })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiProperty({ example: 'sentAt', required: false })
  @IsOptional()
  sortBy: string = 'sentAt';

  @ApiProperty({ example: -1, required: false })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  sortOrder: -1 | 1 = -1;
}
