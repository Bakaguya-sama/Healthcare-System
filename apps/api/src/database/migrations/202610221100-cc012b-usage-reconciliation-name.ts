import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';
import { CC012B_AI_RESERVATION_COLLECTION } from './202610211000-cc012b-ai-quota';

export const CC012B_USAGE_RECONCILIATION_NAME_VERSION = 202610221100;
export const CC012B_USAGE_RECONCILIATION_NAME =
  'cc012b-usage-reconciliation-name';
export const CC012B_USAGE_RECONCILIATION_NAME_CHECKSUM = migrationChecksum({
  version: CC012B_USAGE_RECONCILIATION_NAME_VERSION,
  name: CC012B_USAGE_RECONCILIATION_NAME,
  steps: ['rename-settlement-pending-to-usage-reconciliation-required'],
});

export async function applyCc012bUsageReconciliationName(
  db: Db,
): Promise<void> {
  const collection = db.collection(CC012B_AI_RESERVATION_COLLECTION.name);
  await db.command({
    collMod: CC012B_AI_RESERVATION_COLLECTION.name,
    validationLevel: 'off',
  });
  await collection.updateMany(
    { status: 'settlement_pending' },
    {
      $set: { status: 'usage_reconciliation_required' },
      $rename: {
        settlementPendingAt: 'usageReconciliationRequiredAt',
      },
    },
  );
  await db.command({
    collMod: CC012B_AI_RESERVATION_COLLECTION.name,
    validator: CC012B_AI_RESERVATION_COLLECTION.validator,
    validationLevel: 'strict',
    validationAction: 'error',
  });
}
