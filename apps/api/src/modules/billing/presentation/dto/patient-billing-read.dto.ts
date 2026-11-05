import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { PageSortQueryDto } from '../../../../common/pagination';
import { SubscriptionStatus } from '../../domain/entities/subscription.entity';

export class QueryPublishedPlansDto extends PageSortQueryDto {
  @ApiPropertyOptional({
    enum: ['code', 'name', 'price', 'version', 'effectiveFrom'],
  })
  @IsOptional()
  @IsIn(['code', 'name', 'price', 'version', 'effectiveFrom'])
  sortBy: 'code' | 'name' | 'price' | 'version' | 'effectiveFrom' = 'code';
}

export class QueryPatientSubscriptionsDto extends PageSortQueryDto {
  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({
    enum: ['startedAt', 'currentPeriodStart', 'currentPeriodEnd', 'expiresAt'],
  })
  @IsOptional()
  @IsIn(['startedAt', 'currentPeriodStart', 'currentPeriodEnd', 'expiresAt'])
  sortBy:
    | 'startedAt'
    | 'currentPeriodStart'
    | 'currentPeriodEnd'
    | 'expiresAt' = 'startedAt';
}

export class PatientPlanBenefitsDto {
  @ApiPropertyOptional() weeklyAiSummary?: boolean;
  @ApiPropertyOptional({
    enum: ['weekly', 'thirty_day', 'ninety_day'],
    isArray: true,
  })
  reports?: string[];
  @ApiPropertyOptional() smartReminder?: boolean;
  @ApiPropertyOptional() medicationReminder?: boolean;
  @ApiPropertyOptional({ enum: ['pdf', 'csv'], isArray: true })
  exports?: string[];
  @ApiPropertyOptional() doctorReview?: boolean;
  @ApiPropertyOptional() priorityInbox?: boolean;
  @ApiPropertyOptional() followUp?: boolean;
  @ApiPropertyOptional() familyLinkLimit?: number;
  @ApiPropertyOptional() facilitySearch?: boolean;
  @ApiPropertyOptional() summaryTokenBudget?: number;
}

export class PatientPlanQuotaDto {
  @ApiProperty() aiRequestLimit: number;
  @ApiProperty() aiTokenLimit: number;
  @ApiProperty({ enum: ['day', 'subscription_cycle'] })
  aiQuotaPeriod: 'day' | 'subscription_cycle';
  @ApiProperty() consultationLimitPerCycle: number;
  @ApiProperty() activeCareProgramLimit: number;
}

export class PatientPlanSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() code: string;
  @ApiProperty() version: number;
  @ApiProperty() name: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() price: number;
  @ApiProperty({ example: 'VND' }) currency: string;
  @ApiProperty() durationDays: number;
  @ApiProperty({ type: PatientPlanQuotaDto }) quota: PatientPlanQuotaDto;
  @ApiProperty({ type: PatientPlanBenefitsDto })
  benefits: PatientPlanBenefitsDto;
  @ApiProperty({
    description: 'True for the effective published catalog window.',
  })
  available: boolean;
  @ApiProperty({
    description:
      'True only when the existing VNPAY order flow can buy this Plan.',
  })
  purchasable: boolean;
  @ApiPropertyOptional() effectiveFrom?: string;
  @ApiPropertyOptional() effectiveUntil?: string;
}

export class PatientPlanPageDto {
  @ApiProperty({ type: [PatientPlanSummaryDto] })
  items: PatientPlanSummaryDto[];
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}

export class PatientSubscriptionPlanDto {
  @ApiProperty() id: string;
  @ApiProperty() code: string;
  @ApiProperty() version: number;
  @ApiProperty() name: string;
}

export class PatientSubscriptionCycleDto {
  @ApiProperty() number: number;
  @ApiProperty() startedAt: string;
  @ApiProperty() endsAt: string;
}

export class PatientSubscriptionBenefitsDto extends PatientPlanQuotaDto {
  @ApiProperty({ type: PatientPlanBenefitsDto })
  benefits: PatientPlanBenefitsDto;
}

export class PatientSubscriptionRenewalDto extends PatientSubscriptionPlanDto {
  @ApiProperty() effectiveAt: string;
}

export class PatientSubscriptionSummaryDto {
  @ApiProperty() subscriptionId: string;
  @ApiProperty({ enum: SubscriptionStatus }) status: SubscriptionStatus;
  @ApiProperty({ type: PatientSubscriptionPlanDto })
  plan: PatientSubscriptionPlanDto;
  @ApiProperty({ type: PatientSubscriptionCycleDto })
  cycle: PatientSubscriptionCycleDto;
  @ApiProperty({ type: PatientSubscriptionBenefitsDto })
  entitlement: PatientSubscriptionBenefitsDto;
  @ApiProperty() startedAt: string;
  @ApiProperty() expiresAt: string;
  @ApiPropertyOptional({
    type: PatientSubscriptionRenewalDto,
    description:
      'Safe queued-renewal snapshot; no PaymentOrder identifier is exposed.',
  })
  renewal?: PatientSubscriptionRenewalDto;
  @ApiProperty() updatedAt: string;
}

export class PatientSubscriptionPageDto {
  @ApiProperty({
    type: PatientSubscriptionSummaryDto,
    nullable: true,
    description:
      'Current effective Subscription selected by the billing lifecycle authority.',
  })
  effective: PatientSubscriptionSummaryDto | null;
  @ApiProperty({ type: [PatientSubscriptionSummaryDto] })
  items: PatientSubscriptionSummaryDto[];
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}

export class ConsultationUsageProjectionDto {
  @ApiProperty({
    nullable: true,
    description: 'Null only for a future unlimited entitlement.',
  })
  limit: number | null;
  @ApiProperty() counted: number;
  @ApiProperty() reserved: number;
  @ApiProperty({
    nullable: true,
    description: 'Null only when unlimited=true.',
  })
  available: number | null;
  @ApiProperty({
    description:
      'Current Plan schema has no unlimited consultation sentinel; currently false.',
  })
  unlimited: boolean;
}

export class PatientSubscriptionUsageDto {
  @ApiProperty() subscriptionId: string;
  @ApiProperty({ type: PatientSubscriptionCycleDto })
  cycle: PatientSubscriptionCycleDto;
  @ApiProperty({ type: ConsultationUsageProjectionDto })
  consultations: ConsultationUsageProjectionDto;
  @ApiProperty() asOf: string;
}
