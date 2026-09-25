import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';
export const RF9_ATOMIC_NOTIFICATIONS_VERSION = 202609182510;
export const RF9_ATOMIC_NOTIFICATIONS_NAME = 'rf9-atomic-notifications';
export const RF9_ATOMIC_NOTIFICATIONS_CHECKSUM = migrationChecksum({ version: RF9_ATOMIC_NOTIFICATIONS_VERSION, name: RF9_ATOMIC_NOTIFICATIONS_NAME, steps: ['create-notification-idempotency-index'] });
export async function applyRf9AtomicNotifications(db: Db): Promise<void> {
  await db.collection('notifications').createIndex({ idempotencyKey: 1 }, { name: 'idempotencyKey_unique', unique: true, sparse: true });
}
