import { NestFactory } from '@nestjs/core';
import { OutboxWorkerModule } from './modules/outbox/outbox-worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(OutboxWorkerModule);
  app.enableShutdownHooks();
}
void bootstrap();
