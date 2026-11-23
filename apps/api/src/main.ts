import { ConsoleLogger } from '@nestjs/common';
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
  const isStructuredEnvironment =
    config.getOrThrow<string>('NODE_ENV') === 'staging' ||
    config.getOrThrow<string>('NODE_ENV') === 'production';
  const logger = isStructuredEnvironment
    ? new JsonLogger()
    : new ConsoleLogger('Healthcare API', {
        colors: true,
        timestamp: true,
      });
  app.useLogger(logger);
  configureApplication(app, config);

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  if (isStructuredEnvironment) {
    logger.log({
      event: 'application_started',
      port,
      apiPrefix: config.getOrThrow<string>('API_PREFIX'),
      apiVersion: config.getOrThrow<string>('API_VERSION'),
      swaggerEnabled: config.getOrThrow<boolean>('SWAGGER_ENABLED'),
    });
  } else {
    logger.log(
      `Application started on port ${port} (/${config.getOrThrow<string>('API_PREFIX')}/v${config.getOrThrow<string>('API_VERSION')})`,
    );
  }
}

void bootstrap().catch((error: unknown) => {
  const isStructuredEnvironment =
    process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'production';
  const logger = isStructuredEnvironment
    ? new JsonLogger()
    : new ConsoleLogger('Healthcare API', {
        colors: true,
        timestamp: true,
      });
  logger.fatal(error);
  process.exitCode = 1;
});
