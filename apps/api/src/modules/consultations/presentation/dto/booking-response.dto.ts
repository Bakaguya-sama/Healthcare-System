import { ApiProperty } from '@nestjs/swagger';
import { AvailabilitySlotStatus } from '../../domain/entities/availability/availability-slot.entity';
import {
  ConsultationMode,
  ConsultationQuotaPolicy,
  ConsultationRequestStatus,
  ConsultationSessionStatus,
} from '../../domain/entities/consultations/consultation.entity';

export class AvailabilitySlotDto {
  @ApiProperty() id!: string;
  @ApiProperty() doctorId!: string;
  @ApiProperty({ format: 'date-time' }) startAt!: string;
  @ApiProperty({ format: 'date-time' }) endAt!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty({ enum: AvailabilitySlotStatus })
  status!: AvailabilitySlotStatus;
  @ApiProperty({ required: false, format: 'date-time' }) blockedAt?: string;
  @ApiProperty({ required: false }) blockedBy?: string;
  @ApiProperty({ required: false }) blockReason?: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class AvailabilitySlotResponseDto {
  @ApiProperty() statusCode!: number;
  @ApiProperty({ type: AvailabilitySlotDto }) data!: AvailabilitySlotDto;
}

export class PagePaginationDto {
  @ApiProperty({ minimum: 1 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100 }) limit!: number;
  @ApiProperty({ minimum: 0 }) total!: number;
  @ApiProperty({ minimum: 0 }) pages!: number;
}

export class AvailabilitySlotListResponseDto {
  @ApiProperty({ type: [AvailabilitySlotDto] }) data!: AvailabilitySlotDto[];
  @ApiProperty({ type: PagePaginationDto })
  pagination!: PagePaginationDto;
}

export class ScheduledConsultationDto {
  @ApiProperty() id!: string;
  @ApiProperty() patientId!: string;
  @ApiProperty() doctorId!: string;
  @ApiProperty() availabilitySlotId!: string;
  @ApiProperty({ enum: ConsultationMode }) mode!: ConsultationMode;
  @ApiProperty({ enum: ConsultationRequestStatus })
  requestStatus!: ConsultationRequestStatus;
  @ApiProperty({ enum: ConsultationSessionStatus })
  sessionStatus!: ConsultationSessionStatus;
  @ApiProperty({ enum: ConsultationQuotaPolicy })
  quotaPolicy!: ConsultationQuotaPolicy;
  @ApiProperty({ format: 'date-time' }) requestedAt!: string;
  @ApiProperty({ format: 'date-time' }) respondedAt!: string;
  @ApiProperty({ format: 'date-time' }) scheduledStartAt!: string;
  @ApiProperty({ format: 'date-time' }) scheduledEndAt!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty() expectedDurationMinutes!: number;
  @ApiProperty({ type: Object })
  bookingSettingsSnapshot!: Record<string, unknown>;
  @ApiProperty({ required: false }) patientNotes?: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class ScheduledConsultationResponseDto {
  @ApiProperty() statusCode!: number;
  @ApiProperty({ type: ScheduledConsultationDto })
  data!: ScheduledConsultationDto;
}
