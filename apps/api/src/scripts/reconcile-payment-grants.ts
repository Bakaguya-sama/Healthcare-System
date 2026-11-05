import { NestFactory } from '@nestjs/core';
import { OutboxWorkerModule } from '../infrastructure/outbox/outbox-worker.module';
import { SubscriptionPaymentGrantService } from '../modules/billing/application/services/subscription-payment-grant.service';

async function main() {
  const context = await NestFactory.createApplicationContext(OutboxWorkerModule);
  try {
    const service = context.get(SubscriptionPaymentGrantService, {
      strict: false,
    });
    const orderId = process.argv[2];
    const result = orderId
      ? await service.reconcilePaidOrder(orderId)
      : await service.reconcilePaidWithoutGrant();
    console.log(JSON.stringify(result));
  } finally {
    await context.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
