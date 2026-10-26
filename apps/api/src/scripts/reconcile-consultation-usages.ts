import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ConsultationUsageService } from '../modules/billing/application/services/consultation-usage.service';
import { ConsultationsService } from '../modules/consultations/application/services/consultations/consultations.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const limit = Number(process.env.CONSULTATION_USAGE_RECONCILE_LIMIT ?? 100);
    const usage = app.get(ConsultationUsageService);
    const consultations = app.get(ConsultationsService);
    const reservations = await usage.listReserved(
      process.env.CONSULTATION_USAGE_RECONCILE_AFTER,
      limit,
    );
    const results = {
      unchanged: 0,
      counted: 0,
      released: 0,
      conflict: 0,
      missing_consultation: 0,
    };
    for (const item of reservations)
      results[
        await consultations.reconcileReservedUsage(item.consultationId)
      ]++;
    const counters = await usage.reconcileCounters(
      limit,
      process.env.CONSULTATION_COUNTER_RECONCILE_AFTER,
    );
    console.log(
      JSON.stringify({
        reservations: {
          scanned: reservations.length,
          ...results,
          nextCursor: reservations.at(-1)?.cursor ?? null,
        },
        counters,
      }),
    );
  } finally {
    await app.close();
  }
}

void main();
