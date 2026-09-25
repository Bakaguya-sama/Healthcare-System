import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

const ERROR_STATUSES = ['400', '401', '403', '404', '409', '429', '500'];

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Healthcare API')
    .setDescription('Healthcare consultation platform REST API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token returned by the local authentication flow',
      },
      'bearer',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });

  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.ErrorResponse = {
    type: 'object',
    required: [
      'statusCode',
      'timestamp',
      'path',
      'method',
      'correlationId',
      'error',
      'message',
    ],
    properties: {
      statusCode: { type: 'integer' },
      timestamp: { type: 'string', format: 'date-time' },
      path: { type: 'string' },
      method: { type: 'string' },
      correlationId: { type: 'string' },
      error: { type: 'string' },
      message: {
        oneOf: [
          { type: 'string' },
          { type: 'array', items: { type: 'string' } },
        ],
      },
    },
  };

  for (const pathItem of Object.values(document.paths)) {
    for (const operation of Object.values(
      (pathItem ?? {}) as Record<string, unknown>,
    )) {
      if (
        !operation ||
        typeof operation !== 'object' ||
        !('responses' in operation)
      ) {
        continue;
      }
      const responses = (operation as { responses: Record<string, unknown> })
        .responses;
      for (const status of ERROR_STATUSES) {
        responses[status] ??= {
          description: `HTTP ${status} error`,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        };
      }
    }
  }

  return document;
}
