import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BILLING_CARE_PROGRAM_ACCESS } from './application/ports/care-program-access.port';
import { FreeSubscriptionGrantService } from './application/services/free-subscription-grant.service';
import { SubscriptionCareProgramAccessService } from './application/services/subscription-care-program-access.service';
import { ConsultationUsageService } from './application/services/consultation-usage.service';
import { CONSULTATION_USAGE_PORT } from './application/ports/consultation-usage.port';
import { Plan, PlanSchema } from './domain/entities/plan.entity';
import {
  Subscription,
  SubscriptionSchema,
} from './domain/entities/subscription.entity';
import {
  ConsultationUsage,
  ConsultationUsageSchema,
} from './domain/entities/consultation-usage.entity';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { AiQuotaService } from './application/services/ai-quota.service';
import { PlanAdministrationService } from './application/services/plan-administration.service';
import { PlansController } from './presentation/controllers/plans.controller';
import { AI_QUOTA_PORT } from './application/ports/ai-quota.port';
import { AiUsageDaily, AiUsageDailySchema, AiQuotaReservation, AiQuotaReservationSchema } from './domain/entities/ai-usage.entity';

@Module({
  imports: [
    PlatformAuditModule,
    MongooseModule.forFeature([
      { name: Plan.name, schema: PlanSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: ConsultationUsage.name, schema: ConsultationUsageSchema },
      { name: AiUsageDaily.name, schema: AiUsageDailySchema },
      { name: AiQuotaReservation.name, schema: AiQuotaReservationSchema },
    ]),
  ],
  controllers: [PlansController],
  providers: [
    FreeSubscriptionGrantService,
    SubscriptionCareProgramAccessService,
    ConsultationUsageService,
    AiQuotaService,
    PlanAdministrationService,
    {
      provide: BILLING_CARE_PROGRAM_ACCESS,
      useExisting: SubscriptionCareProgramAccessService,
    },
    {
      provide: CONSULTATION_USAGE_PORT,
      useExisting: ConsultationUsageService,
    },
    { provide: AI_QUOTA_PORT, useExisting: AiQuotaService },
  ],
  exports: [BILLING_CARE_PROGRAM_ACCESS, CONSULTATION_USAGE_PORT, AI_QUOTA_PORT],
})
export class BillingModule {}
