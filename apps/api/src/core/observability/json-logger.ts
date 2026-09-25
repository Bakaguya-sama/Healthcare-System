import type { LoggerService, LogLevel } from '@nestjs/common';
import { CorrelationContext } from './correlation-context';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY =
  /^(authorization|cookie|password|passwordHash|refreshToken|accessToken|otp|otpCode|apiKey|apiSecret|secret)$/i;

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
    return { name: value.name, message: redactLogValue(value.message) };
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
