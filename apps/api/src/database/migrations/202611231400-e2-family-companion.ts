import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const E2_FAMILY_COMPANION_VERSION = 202611231400;
export const E2_FAMILY_COMPANION_NAME = 'e2-family-companion';
export const E2_FAMILY_COMPANION_CHECKSUM = migrationChecksum({
  version: E2_FAMILY_COMPANION_VERSION,
  name: E2_FAMILY_COMPANION_NAME,
  defaults: { FREE: 1, PLUS: 3, CARE: 5 },
  collections: ['plans', 'subscriptions', 'familylinks', 'familypermissions', 'familyreminders'],
});

export async function applyE2FamilyCompanion(db: Db): Promise<void> {
  const defaults: Record<string, number> = { FREE: 1, PLUS: 3, CARE: 5 };
  for (const [code, limit] of Object.entries(defaults)) {
    await db.collection('plans').updateMany(
      { code, familyLinkLimit: { $exists: false } },
      { $set: { familyLinkLimit: limit } },
    );
  }
  await db.collection('plans').updateMany(
    { familyLinkLimit: { $exists: false } },
    { $set: { familyLinkLimit: 0 } },
  );
  for (const [code, limit] of Object.entries(defaults)) {
    await db.collection('subscriptions').updateMany(
      { 'planSnapshot.code': code, 'planSnapshot.familyLinkLimit': { $exists: false } },
      { $set: { 'planSnapshot.familyLinkLimit': limit } },
    );
  }
  await db.collection('subscriptions').updateMany(
    { 'planSnapshot.familyLinkLimit': { $exists: false } },
    { $set: { 'planSnapshot.familyLinkLimit': 0 } },
  );

  await db.collection('familylinks').createIndex(
    { patientId: 1, familyUserId: 1 },
    { name: 'patientId_1_familyUserId_1', unique: true, partialFilterExpression: { familyUserId: { $type: 'objectId' } } },
  );
  await db.collection('familylinks').createIndex(
    { patientId: 1, status: 1, updatedAt: -1 },
    { name: 'patientId_1_status_1_updatedAt_-1' },
  );
  await db.collection('familylinks').createIndex(
    { familyUserId: 1, status: 1, updatedAt: -1 },
    { name: 'familyUserId_1_status_1_updatedAt_-1', sparse: true },
  );
  await db.collection('familylinks').createIndex(
    { invitationTokenHash: 1 },
    { name: 'invitationTokenHash_1', unique: true, sparse: true },
  );
  await db.collection('familylinks').createIndex(
    { invitationExpiresAt: 1, status: 1 },
    { name: 'invitationExpiresAt_1_status_1' },
  );
  await db.collection('familypermissions').createIndex(
    { familyLinkId: 1, status: 1, createdAt: -1 },
    { name: 'familyLinkId_1_status_1_createdAt_-1' },
  );
  await db.collection('familypermissions').createIndex(
    { patientId: 1, status: 1, createdAt: -1 },
    { name: 'patientId_1_status_1_createdAt_-1' },
  );
  await db.collection('familyreminders').createIndex(
    { uniqueKey: 1 },
    { name: 'uniqueKey_1', unique: true },
  );
  await db.collection('familyreminders').createIndex(
    { careTaskId: 1, status: 1 },
    { name: 'careTaskId_1_status_1' },
  );
  await db.collection('familyreminders').createIndex(
    { familyLinkId: 1, createdAt: -1 },
    { name: 'familyLinkId_1_createdAt_-1' },
  );
  await db.collection('familyreminders').createIndex(
    { status: 1, scheduledAt: 1 },
    { name: 'status_1_scheduledAt_1' },
  );
}
