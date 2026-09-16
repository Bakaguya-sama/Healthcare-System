import {
  IsDateString,
  IsString,
  IsOptional,
  IsEnum,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus } from '../entities/ai-session.entity';
import { PageSortQueryDto } from '../../../common/pagination';

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

export class QueryAiSessionDto extends PageSortQueryDto {
  @ApiProperty({
    required: false,
    enum: Object.values(SessionStatus),
    description: 'Filter by status',
  })
  @IsOptional()
  status?: SessionStatus;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  @IsIn(['createdAt', 'startedAt', 'endedAt'])
  sortBy?: 'createdAt' | 'startedAt' | 'endedAt' = 'createdAt';

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
