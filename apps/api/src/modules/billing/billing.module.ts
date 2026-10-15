import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BILLING_CARE_PROGRAM_ACCESS } from './application/ports/care-program-access.port';
import { FreeSubscriptionGrantService } from './application/services/free-subscription-grant.service';
import { SubscriptionCareProgramAccessService } from './application/services/subscription-care-program-access.service';
import { Plan, PlanSchema } from './domain/entities/plan.entity';
import {
  Subscription,
  SubscriptionSchema,
} from './domain/entities/subscription.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Plan.name, schema: PlanSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
  ],
  providers: [
    FreeSubscriptionGrantService,
    SubscriptionCareProgramAccessService,
    {
      provide: BILLING_CARE_PROGRAM_ACCESS,
      useExisting: SubscriptionCareProgramAccessService,
    },
  ],
  exports: [BILLING_CARE_PROGRAM_ACCESS],
})
export class BillingModule {}
