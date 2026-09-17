import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { CorrelationContext } from './correlation-context';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
const SAFE_CORRELATION_ID = /^[a-zA-Z0-9._-]{1,128}$/;
const requestLogger = new Logger('HTTP');

export function correlationMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const received = request.header(CORRELATION_ID_HEADER);
  const correlationId =
    received && SAFE_CORRELATION_ID.test(received) ? received : randomUUID();
  const startedAt = performance.now();

  response.setHeader(CORRELATION_ID_HEADER, correlationId);
  CorrelationContext.run(correlationId, () => {
    response.on('finish', () => {
      requestLogger.log({
        event: 'http_request_completed',
        method: request.method,
        path: request.originalUrl || request.url,
        statusCode: response.statusCode,
        durationMs: Number((performance.now() - startedAt).toFixed(3)),
      });
    });
    next();
  });
}
