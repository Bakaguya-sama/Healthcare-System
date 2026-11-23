import type { LoggerService, LogLevel } from '@nestjs/common';
import { CorrelationContext } from './correlation-context';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY =
  /^(authorization|cookie|password|passwordHash|refreshToken|accessToken|otp|otpCode|apiKey|apiSecret|secret)$/i;

type RedactedError = {
  name: string;
  message: unknown;
  stack?: unknown;
  cause?: unknown;
  errors?: unknown[];
};

/**
 * Keeps bootstrap failures diagnosable without emitting credentials. In
 * particular, AggregateError stores its useful failures in `errors`, not in
 * its often-empty message.
 */
export function redactError(
  error: Error,
  seen: WeakSet<Error> = new WeakSet(),
): RedactedError {
  if (seen.has(error)) {
    return {
      name: error.name,
      message: '[Circular error cause]',
    };
  }

  seen.add(error);
  const result: RedactedError = {
    name: error.name,
    message: redactLogValue(error.message),
  };

  if (error.stack) {
    result.stack = redactLogValue(error.stack);
  }

  if (error.cause !== undefined) {
    result.cause =
      error.cause instanceof Error
        ? redactError(error.cause, seen)
        : redactLogValue(error.cause);
  }

  if (error instanceof AggregateError) {
    result.errors = Array.from(error.errors, (nested) =>
      nested instanceof Error ? redactError(nested, seen) : redactLogValue(nested),
    );
  }

  return result;
}

export function redactLogValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
      .replace(
        /((?:password|refreshToken|accessToken|otpCode|apiKey|apiSecret|secret)\s*[=:]\s*)[^\s,;]+/gi,
        `$1${REDACTED}`,
      );
  }
  if (Array.isArray(value)) return value.map(redactLogValue);
  if (value instanceof Error) {
    return redactError(value);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SENSITIVE_KEY.test(key) ? REDACTED : redactLogValue(nested),
      ]),
    );
  }
  return value;
}

export class JsonLogger implements LoggerService {
  private levels: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose'];

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  setLogLevels(levels: LogLevel[]): void {
    this.levels = levels;
  }

  private write(
    level: 'info' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal',
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const nestLevel = level === 'info' ? 'log' : level;
    if (nestLevel !== 'fatal' && !this.levels.includes(nestLevel as LogLevel)) {
      return;
    }

    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      correlationId: CorrelationContext.getId(),
      message: redactLogValue(message),
      context: redactLogValue(optionalParams),
    });
    const output =
      level === 'error' || level === 'fatal' ? console.error : console.log;
    output(entry);
  }
}
