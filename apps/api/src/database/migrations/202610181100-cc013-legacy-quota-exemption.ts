import type { Db } from 'mongodb';
import { DATA001A_CONSULTATION_COLLECTION } from './202610152000-data001a-consultation-contract';
import { migrationChecksum } from './migration.types';

export const CC013_LEGACY_EXEMPTION_VERSION = 202610181100;
export const CC013_LEGACY_EXEMPTION_NAME = 'cc013-legacy-quota-exemption';
export const CC013_LEGACY_EXEMPTION_CHECKSUM = migrationChecksum({
  version: CC013_LEGACY_EXEMPTION_VERSION,
  name: CC013_LEGACY_EXEMPTION_NAME,
  steps: ['allow-legacy-quota-exempt-flag'],
});
export const CC013_CONSULTATION_COLLECTION = {
  ...DATA001A_CONSULTATION_COLLECTION,
  validator: {
    $jsonSchema: {
      ...DATA001A_CONSULTATION_COLLECTION.validator.$jsonSchema,
      properties: {
        ...DATA001A_CONSULTATION_COLLECTION.validator.$jsonSchema.properties,
        legacyQuotaExempt: { bsonType: 'bool' },
      },
    },
  },
} as const;

export async function applyCc013LegacyExemption(db: Db) {
  await db.command({
    collMod: CC013_CONSULTATION_COLLECTION.name,
    validator: CC013_CONSULTATION_COLLECTION.validator,
    validationLevel: 'strict',
    validationAction: 'error',
  });
}
