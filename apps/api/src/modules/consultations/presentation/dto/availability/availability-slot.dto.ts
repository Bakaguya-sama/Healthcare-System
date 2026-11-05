import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PageQueryDto } from '../../../../../common/pagination';
import { AvailabilitySlotStatus } from '../../../domain/entities/availability/availability-slot.entity';

export class CreateAvailabilitySlotDto {
  @ApiProperty({ example: '2026-11-10T02:00:00.000Z' })
  @IsDateString()
  startAt!: string;

  @ApiProperty({ example: '2026-11-10T02:30:00.000Z' })
  @IsDateString()
  endAt!: string;

  @ApiProperty({ example: 'Asia/Ho_Chi_Minh' })
  @IsString()
  @MaxLength(64)
  timezone!: string;
}

export class UpdateAvailabilitySlotDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiProperty({ required: false, example: 'Asia/Ho_Chi_Minh' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

export class BlockAvailabilitySlotDto {
  @ApiProperty({ example: 'Doctor unavailable', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class QueryAvailableSlotDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: [-1, 1], default: 1 })
  @Transform(({ value }) => {
    if (value === 1 || value === '1') return 1;
    if (value === -1 || value === '-1') return -1;
    return value as unknown;
  })
  @IsIn([-1, 1])
  sortOrder: 1 | -1 = 1;

  @ApiProperty({ example: '2026-11-03T00:00:00.000Z' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-12-03T00:00:00.000Z' })
  @IsDateString()
  to!: string;
}

export class QueryAvailabilitySlotDto extends QueryAvailableSlotDto {
  @ApiProperty({ enum: AvailabilitySlotStatus, required: false })
  @IsOptional()
  @IsEnum(AvailabilitySlotStatus)
  status?: AvailabilitySlotStatus;
}
