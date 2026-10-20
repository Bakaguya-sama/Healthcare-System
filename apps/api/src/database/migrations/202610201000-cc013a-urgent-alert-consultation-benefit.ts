import type { Db } from 'mongodb';
import { CC013_CONSULTATION_COLLECTION } from './202610181100-cc013-legacy-quota-exemption';
import { migrationChecksum } from './migration.types';

export const CC013A_URGENT_ALERT_BENEFIT_VERSION = 202610201000;
export const CC013A_URGENT_ALERT_BENEFIT_NAME =
  'cc013a-urgent-alert-consultation-benefit';
export const CC013A_URGENT_ALERT_BENEFIT_CHECKSUM = migrationChecksum({
  version: CC013A_URGENT_ALERT_BENEFIT_VERSION,
  name: CC013A_URGENT_ALERT_BENEFIT_NAME,
  steps: ['allow-consultation-quota-policy-snapshot'],
});

/** Existing records remain ordinary quota consultations; no backfill occurs. */
export const CC013A_CONSULTATION_COLLECTION = {
  ...CC013_CONSULTATION_COLLECTION,
  validator: {
    $jsonSchema: {
      ...CC013_CONSULTATION_COLLECTION.validator.$jsonSchema,
      properties: {
        ...CC013_CONSULTATION_COLLECTION.validator.$jsonSchema.properties,
        quotaPolicy: {
          bsonType: 'string',
          enum: ['consultation_limit', 'care_program_included'],
        },
      },
    },
  },
} as const;

export async function applyCc013aUrgentAlertBenefit(db: Db) {
  await db.command({
    collMod: CC013A_CONSULTATION_COLLECTION.name,
    validator: CC013A_CONSULTATION_COLLECTION.validator,
    validationLevel: 'strict',
    validationAction: 'error',
  });
}
