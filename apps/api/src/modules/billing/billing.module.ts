import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { VnpayModule } from 'nestjs-vnpay';
import { ignoreLogger } from 'vnpay';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
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
import { PaymentOrder, PaymentOrderSchema, PaymentTransaction, PaymentTransactionSchema } from './domain/entities/payment.entity';
import { PAYMENT_PROVIDER } from './application/ports/payment-provider.port';
import { VnpayPaymentGatewayAdapter } from './infrastructure/vnpay/vnpay-payment-gateway.adapter';
import { PaymentOrderService } from './application/services/payment-order.service';
import { SubscriptionPaymentGrantService } from './application/services/subscription-payment-grant.service';
import { PaymentsController } from './presentation/controllers/payments.controller';
import { PaymentEvidenceService } from './application/services/payment-evidence.service';
import { PaymentQrService } from './infrastructure/qr/payment-qr.service';

@Module({
  imports: [
    PlatformAuditModule,
    OutboxModule,
    VnpayModule.registerAsync({ imports: [ConfigModule], inject: [ConfigService], useFactory: (config: ConfigService) => ({ tmnCode: config.get<string>('VNPAY_TMN_CODE') ?? 'DISABLED', secureSecret: config.get<string>('VNPAY_HASH_SECRET') ?? 'DISABLED', testMode: config.get<boolean>('VNPAY_SANDBOX') === true, loggerFn: ignoreLogger }) }),
    MongooseModule.forFeature([
      { name: Plan.name, schema: PlanSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: ConsultationUsage.name, schema: ConsultationUsageSchema },
      { name: AiUsageDaily.name, schema: AiUsageDailySchema },
      { name: AiQuotaReservation.name, schema: AiQuotaReservationSchema },
      { name: PaymentOrder.name, schema: PaymentOrderSchema },
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
    ]),
  ],
  controllers: [PlansController, PaymentsController],
  providers: [
    FreeSubscriptionGrantService,
    SubscriptionCareProgramAccessService,
    ConsultationUsageService,
    AiQuotaService,
    PlanAdministrationService,
    PaymentOrderService,
    PaymentEvidenceService,
    PaymentQrService,
    SubscriptionPaymentGrantService,
    VnpayPaymentGatewayAdapter,
    {
      provide: BILLING_CARE_PROGRAM_ACCESS,
      useExisting: SubscriptionCareProgramAccessService,
    },
    {
      provide: CONSULTATION_USAGE_PORT,
      useExisting: ConsultationUsageService,
    },
    { provide: AI_QUOTA_PORT, useExisting: AiQuotaService },
    { provide: PAYMENT_PROVIDER, useExisting: VnpayPaymentGatewayAdapter },
  ],
  exports: [BILLING_CARE_PROGRAM_ACCESS, CONSULTATION_USAGE_PORT, AI_QUOTA_PORT, SubscriptionPaymentGrantService],
})
export class BillingModule {}
