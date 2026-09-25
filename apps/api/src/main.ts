import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApplication } from './bootstrap/configure-application';
import { JsonLogger } from './core/observability/json-logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  const config = app.get(ConfigService);
  app.useLogger(new JsonLogger());
  configureApplication(app, config);

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  new JsonLogger().log({
    event: 'application_started',
    port,
    apiPrefix: config.getOrThrow<string>('API_PREFIX'),
    apiVersion: config.getOrThrow<string>('API_VERSION'),
    swaggerEnabled: config.getOrThrow<boolean>('SWAGGER_ENABLED'),
  });
}

void bootstrap().catch((error: unknown) => {
  new JsonLogger().fatal(error);
  process.exitCode = 1;
});
