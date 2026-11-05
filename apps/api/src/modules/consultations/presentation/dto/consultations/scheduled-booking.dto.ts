import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateScheduledBookingDto {
  @ApiProperty()
  @IsMongoId()
  availabilitySlotId!: string;

  @ApiProperty({ required: false, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  patientNotes?: string;
}

export class RescheduleBookingDto {
  @ApiProperty()
  @IsMongoId()
  availabilitySlotId!: string;
}
