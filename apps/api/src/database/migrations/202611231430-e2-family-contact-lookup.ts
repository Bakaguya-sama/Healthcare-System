import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const E2_FAMILY_CONTACT_LOOKUP_VERSION = 202611231430;
export const E2_FAMILY_CONTACT_LOOKUP_NAME = 'e2-family-contact-lookup';
export const E2_FAMILY_CONTACT_LOOKUP_CHECKSUM = migrationChecksum({
  version: E2_FAMILY_CONTACT_LOOKUP_VERSION,
  name: E2_FAMILY_CONTACT_LOOKUP_NAME,
  collection: 'familycontactlookups',
  indexes: ['tokenHash_1', 'patientId_1_expiresAt_1', 'expiresAt_1'],
});

export async function applyE2FamilyContactLookup(db: Db): Promise<void> {
  const collection = db.collection('familycontactlookups');
  await collection.createIndex(
    { tokenHash: 1 },
    { name: 'tokenHash_1', unique: true },
  );
  await collection.createIndex(
    { patientId: 1, expiresAt: 1 },
    { name: 'patientId_1_expiresAt_1' },
  );
  await collection.createIndex(
    { expiresAt: 1 },
    { name: 'expiresAt_1', expireAfterSeconds: 0 },
  );
}
