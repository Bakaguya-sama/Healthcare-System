import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DoctorBookingSettingsDto {
  @ApiProperty({ enum: ['instant'], example: 'instant' })
  @IsIn(['instant'])
  bookingPolicy!: 'instant';

  @ApiProperty({ minimum: 0, maximum: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  bufferMinutes!: number;

  @ApiProperty({ minimum: 0, maximum: 10080 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10080)
  minNoticeMinutes!: number;

  @ApiProperty({ minimum: 0, maximum: 10080 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10080)
  cancellationDeadlineMinutes!: number;

  @ApiProperty({ minimum: 0, maximum: 1440 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  checkInEarlyMinutes!: number;

  @ApiProperty({ minimum: 0, maximum: 1440 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  noShowAfterMinutes!: number;
}

export class OverrideDoctorBookingSettingsDto extends DoctorBookingSettingsDto {
  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  overrideReason!: string;
}

export class BookingSettingsResponseDto extends DoctorBookingSettingsDto {
  @ApiProperty()
  effectiveFrom!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  updatedBy?: string;
}
