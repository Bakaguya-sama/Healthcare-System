import type { Db } from 'mongodb';
import { CC013A_CONSULTATION_COLLECTION } from './202610201000-cc013a-urgent-alert-consultation-benefit';
import { migrationChecksum } from './migration.types';

export const CC013B_STALE_CONSULTATION_RECOVERY_VERSION = 202610201100;
export const CC013B_STALE_CONSULTATION_RECOVERY_NAME =
  'cc013b-stale-consultation-recovery';
export const CC013B_STALE_CONSULTATION_RECOVERY_CHECKSUM = migrationChecksum({
  version: CC013B_STALE_CONSULTATION_RECOVERY_VERSION,
  name: CC013B_STALE_CONSULTATION_RECOVERY_NAME,
  steps: ['allow-stale-recovery-state', 'add-stale-recovery-indexes'],
});

export const CC013B_CONSULTATION_COLLECTION = {
  ...CC013A_CONSULTATION_COLLECTION,
  validator: {
    $jsonSchema: {
      ...CC013A_CONSULTATION_COLLECTION.validator.$jsonSchema,
      properties: {
        ...CC013A_CONSULTATION_COLLECTION.validator.$jsonSchema.properties,
        onDemandTimeoutWarningQueuedAt: { bsonType: 'date' },
        onDemandTimeoutExtensionExpiresAt: { bsonType: 'date' },
        scheduledStaleReviewQueuedAt: { bsonType: 'date' },
      },
    },
  },
} as const;

export async function applyCc013bStaleConsultationRecovery(db: Db) {
  await db.command({
    collMod: CC013B_CONSULTATION_COLLECTION.name,
    validator: CC013B_CONSULTATION_COLLECTION.validator,
    validationLevel: 'strict',
    validationAction: 'error',
  });
  await db
    .collection(CC013B_CONSULTATION_COLLECTION.name)
    .createIndex(
      { mode: 1, requestStatus: 1, sessionStatus: 1, respondedAt: 1, _id: 1 },
      { name: 'stale_on_demand_recovery' },
    );
  await db.collection(CC013B_CONSULTATION_COLLECTION.name).createIndex(
    {
      mode: 1,
      requestStatus: 1,
      sessionStatus: 1,
      scheduledStartAt: 1,
      _id: 1,
    },
    { name: 'stale_scheduled_review' },
  );
}
