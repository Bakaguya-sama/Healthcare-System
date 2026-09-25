import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { realtimeContract } from '../core/realtime/realtime-contract';

const artifactDirectory = resolve(process.cwd(), 'contracts');
const artifactPath = resolve(artifactDirectory, 'realtime-events.json');
const serialized = `${JSON.stringify(realtimeContract, null, 2)}\n`;

if (process.argv.includes('--check')) {
  if (
    !existsSync(artifactPath) ||
    readFileSync(artifactPath, 'utf8') !== serialized
  ) {
    throw new Error(
      'Realtime contract artifact is stale; run realtime:generate',
    );
  }
} else {
  mkdirSync(artifactDirectory, { recursive: true });
  writeFileSync(artifactPath, serialized, 'utf8');
}
