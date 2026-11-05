import { ApiProperty } from '@nestjs/swagger';
import {
  ConsultationMode,
  ConsultationRequestStatus,
  ConsultationSessionStatus,
} from '../../../domain/entities/consultations/consultation.entity';
import { PagePaginationDto } from '../booking-response.dto';

export class PatientQueueSnapshotDto {
  @ApiProperty() consultationId!: string;
  @ApiProperty({ enum: ['waiting', 'called'] })
  status!: 'waiting' | 'called';
  @ApiProperty({ minimum: 1 }) position!: number;
  @ApiProperty({ nullable: true, type: Number })
  estimatedWaitMinutes!: number | null;
  @ApiProperty({ nullable: true, example: 'ETA_POLICY_NOT_CONFIGURED' })
  etaReason!: string | null;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class CheckedInConsultationDto {
  @ApiProperty() id!: string;
  @ApiProperty() patientId!: string;
  @ApiProperty() doctorId!: string;
  @ApiProperty({ enum: ConsultationRequestStatus })
  requestStatus!: ConsultationRequestStatus;
  @ApiProperty({ enum: ConsultationSessionStatus })
  sessionStatus!: ConsultationSessionStatus;
  @ApiProperty({ format: 'date-time' }) scheduledStartAt!: string;
  @ApiProperty({ format: 'date-time' }) queueJoinedAt!: string;
  @ApiProperty({ format: 'date-time' }) queuePriorityAt!: string;
  @ApiProperty({ required: false, format: 'date-time' }) calledAt?: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class CheckInResponseDto {
  @ApiProperty({ type: CheckedInConsultationDto })
  data!: CheckedInConsultationDto;
  @ApiProperty({ type: PatientQueueSnapshotDto })
  queue!: PatientQueueSnapshotDto;
  @ApiProperty({
    description: 'True when this response replays persisted state',
  })
  replayed!: boolean;
}

export class PatientQueueResponseDto extends PatientQueueSnapshotDto {}

export class QueuePatientDto {
  @ApiProperty() id!: string;
  @ApiProperty({ required: false }) fullName?: string;
  @ApiProperty({ required: false }) avatarUrl?: string;
}

export class DoctorQueueEntryDto {
  @ApiProperty() consultationId!: string;
  @ApiProperty({ type: QueuePatientDto }) patient!: QueuePatientDto;
  @ApiProperty({ enum: ConsultationMode }) mode!: ConsultationMode;
  @ApiProperty({ format: 'date-time' }) scheduledStartAt!: string;
  @ApiProperty({ format: 'date-time' }) queueJoinedAt!: string;
  @ApiProperty({ minimum: 1 }) queuePosition!: number;
  @ApiProperty({ nullable: true, type: Number })
  estimatedWaitMinutes!: number | null;
  @ApiProperty({ nullable: true, example: 'ETA_POLICY_NOT_CONFIGURED' })
  etaReason!: string | null;
  @ApiProperty() isCurrent!: boolean;
  @ApiProperty() isLate!: boolean;
  @ApiProperty({ required: false, format: 'date-time' }) calledAt?: string;
}

export class CurrentConsultationDto {
  @ApiProperty() consultationId!: string;
  @ApiProperty() patientId!: string;
  @ApiProperty({ enum: ConsultationSessionStatus })
  sessionStatus!: ConsultationSessionStatus;
  @ApiProperty({ required: false, format: 'date-time' })
  sessionStartedAt?: string;
}

export class DoctorQueueListResponseDto {
  @ApiProperty({ type: [DoctorQueueEntryDto] }) data!: DoctorQueueEntryDto[];
  @ApiProperty({ nullable: true, type: CurrentConsultationDto })
  currentSession!: CurrentConsultationDto | null;
  @ApiProperty({ type: PagePaginationDto }) pagination!: PagePaginationDto;
}

export class CallNextResponseDto {
  @ApiProperty({ type: CheckedInConsultationDto })
  data!: CheckedInConsultationDto;
  @ApiProperty({
    description: 'True when this response replays persisted state',
  })
  replayed!: boolean;
}
