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

@Module({
  imports: [
    PlatformAuditModule,
    MongooseModule.forFeature([
      { name: Plan.name, schema: PlanSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: ConsultationUsage.name, schema: ConsultationUsageSchema },
    ]),
  ],
  providers: [
    FreeSubscriptionGrantService,
    SubscriptionCareProgramAccessService,
    ConsultationUsageService,
    {
      provide: BILLING_CARE_PROGRAM_ACCESS,
      useExisting: SubscriptionCareProgramAccessService,
    },
    {
      provide: CONSULTATION_USAGE_PORT,
      useExisting: ConsultationUsageService,
    },
  ],
  exports: [BILLING_CARE_PROGRAM_ACCESS, CONSULTATION_USAGE_PORT],
})
export class BillingModule {}
