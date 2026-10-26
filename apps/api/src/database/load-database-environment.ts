import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Migration and verification CLIs run outside Nest's ConfigModule. Load the
 * API-local `.env` without overriding environment variables injected by CI.
 */
export function loadDatabaseEnvironment(): void {
  const environmentFile = resolve(__dirname, '../../.env');
  if (!existsSync(environmentFile)) return;

  for (const rawLine of readFileSync(environmentFile, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2');
  }
}
