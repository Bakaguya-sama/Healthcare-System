import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';
import {
  CC012B_AI_RESERVATION_COLLECTION,
  CC012B_AI_USAGE_COLLECTION,
} from './202610211000-cc012b-ai-quota';

export const CC012B_AI_QUOTA_SETTLEMENT_VERSION = 202610221000;
export const CC012B_AI_QUOTA_SETTLEMENT_NAME = 'cc012b-ai-quota-settlement';
export const CC012B_AI_QUOTA_SETTLEMENT_CHECKSUM = migrationChecksum({
  version: CC012B_AI_QUOTA_SETTLEMENT_VERSION,
  name: CC012B_AI_QUOTA_SETTLEMENT_NAME,
  steps: ['allow-provider-usage-settlement-pending'],
});

export const CC012B_AI_QUOTA_SETTLEMENT_COLLECTIONS = [
  CC012B_AI_USAGE_COLLECTION,
  CC012B_AI_RESERVATION_COLLECTION,
] as const;

export async function applyCc012bAiQuotaSettlement(db: Db): Promise<void> {
  for (const collection of CC012B_AI_QUOTA_SETTLEMENT_COLLECTIONS) {
    await db.command({
      collMod: collection.name,
      validator: collection.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  }
}
