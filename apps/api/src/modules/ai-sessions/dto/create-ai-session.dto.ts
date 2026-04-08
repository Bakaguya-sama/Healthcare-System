import { IsDateString, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus } from '../entities/ai-session.entity';

export class CreateAiSessionDto {
  @ApiProperty({
    description: 'Session status',
    enum: Object.values(SessionStatus),
    default: SessionStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @ApiProperty({ description: 'Session start time' })
  @IsOptional()
  @IsString()
  startedAt?: string;

  @ApiProperty({ description: 'Session end time', required: false })
  @IsOptional()
  @IsString()
  endedAt?: string;
}

export class UpdateAiSessionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  startedAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  endedAt?: string;
}

export class QueryAiSessionDto {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  page: number = 1;

  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  limit: number = 10;

  @ApiProperty({
    required: false,
    enum: Object.values(SessionStatus),
    description: 'Filter by status',
  })
  @IsOptional()
  status?: SessionStatus;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiProperty({ required: false, description: 'Sort order: 1 or -1' })
  @IsOptional()
  sortOrder?: number = -1;

  @ApiProperty({
    required: false,
    description: 'Inclusive start datetime (ISO) for createdAt filter',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({
    required: false,
    description: 'Exclusive end datetime (ISO) for createdAt filter',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
