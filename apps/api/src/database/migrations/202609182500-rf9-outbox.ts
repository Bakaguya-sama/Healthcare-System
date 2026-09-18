import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';
export const RF9_OUTBOX_VERSION = 202609182500;
export const RF9_OUTBOX_NAME = 'rf9-outbox';
export const RF9_OUTBOX_CHECKSUM = migrationChecksum({ version: RF9_OUTBOX_VERSION, name: RF9_OUTBOX_NAME, steps: ['create-outbox-indexes'] });
export async function applyRf9Outbox(db: Db): Promise<void> {
  await db.collection('outboxevents').createIndex({ idempotencyKey: 1 }, { name: 'idempotencyKey_unique', unique: true });
  await db.collection('outboxevents').createIndex({ status: 1, nextAttemptAt: 1, lockedAt: 1, _id: 1 }, { name: 'status_1_nextAttemptAt_1_lockedAt_1__id_1' });
  await db.collection('outboxevents').createIndex({ status: 1, lockExpiresAt: 1, _id: 1 }, { name: 'status_1_lockExpiresAt_1__id_1' });
}
