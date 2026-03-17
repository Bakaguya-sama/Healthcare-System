import {
  IsOptional,
  IsMongoId,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { MessageType, MessageStatus } from '../entities/message.entity';

export class QueryMessageDto {
  @ApiProperty({ example: '65e456def789abc012345678', required: false })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiProperty({ enum: MessageType, required: false })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiProperty({ enum: MessageStatus, required: false })
  @IsOptional()
  @IsEnum(MessageStatus)
  status?: MessageStatus;

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

  @ApiProperty({ example: 'createdAt', required: false })
  @IsOptional()
  sortBy: string = 'createdAt';

  @ApiProperty({ example: -1, required: false })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  sortOrder: -1 | 1 = -1;

  @ApiProperty({
    example: '2026-03-01T00:00:00Z',
    required: false,
  })
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    example: '2026-03-31T23:59:59Z',
    required: false,
  })
  @IsOptional()
  endDate?: string;
}
