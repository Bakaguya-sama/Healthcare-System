import { createHash } from 'node:crypto';
import type { Db } from 'mongodb';

export type DatabaseMigration = {
  version: number;
  name: string;
  checksum: string;
  up(db: Db): Promise<void>;
};

export function migrationChecksum(definition: unknown): string {
  return createHash('sha256').update(JSON.stringify(definition)).digest('hex');
}
