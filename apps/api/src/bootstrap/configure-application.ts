import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { correlationMiddleware } from '../core/observability/correlation.middleware';
import { createOpenApiDocument } from '../core/openapi/openapi';
import { ConfiguredIoAdapter } from './configured-io.adapter';

export type ApplicationConfiguration = {
  mountSwagger?: boolean;
  useWebSocketAdapter?: boolean;
};

function parseTrustProxy(value: string): string | number | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : value;
}

export function configureApplication(
  app: NestExpressApplication,
  config: ConfigService,
  options: ApplicationConfiguration = {},
): void {
  const swaggerEnabled = config.getOrThrow<boolean>('SWAGGER_ENABLED');
  const corsOrigins = config.getOrThrow<string>('CORS_ORIGINS').split(',');

  app.set(
    'trust proxy',
    parseTrustProxy(config.getOrThrow<string>('TRUST_PROXY')),
  );
  app.use(
    helmet({
      contentSecurityPolicy: swaggerEnabled ? false : undefined,
    }),
  );
  app.use(correlationMiddleware);
  app.useBodyParser('json', {
    limit: config.getOrThrow<string>('BODY_LIMIT'),
  });
  app.useBodyParser('urlencoded', {
    limit: config.getOrThrow<string>('BODY_LIMIT'),
    extended: true,
  });
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.setGlobalPrefix(config.getOrThrow<string>('API_PREFIX'));
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: config.getOrThrow<string>('API_VERSION'),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  if (options.useWebSocketAdapter !== false) {
    app.useWebSocketAdapter(new ConfiguredIoAdapter(app, config));
  }

  if (swaggerEnabled && options.mountSwagger !== false) {
    SwaggerModule.setup(
      config.getOrThrow<string>('SWAGGER_PATH'),
      app,
      createOpenApiDocument(app),
    );
  }
}
