import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const E2_FAMILY_IDEMPOTENCY_SCOPE_VERSION = 202611231420;
export const E2_FAMILY_IDEMPOTENCY_SCOPE_NAME = 'e2-family-idempotency-scope';
export const E2_FAMILY_IDEMPOTENCY_SCOPE_CHECKSUM = migrationChecksum({
  version: E2_FAMILY_IDEMPOTENCY_SCOPE_VERSION,
  name: E2_FAMILY_IDEMPOTENCY_SCOPE_NAME,
  index: 'familylinks.patientId_1_idempotencyKey_1',
});

export async function applyE2FamilyIdempotencyScope(db: Db): Promise<void> {
  const collection = db.collection('familylinks');
  const indexes = await collection.listIndexes().toArray();
  if (indexes.some((index) => index.name === 'idempotencyKey_1'))
    await collection.dropIndex('idempotencyKey_1');
  await collection.createIndex(
    { patientId: 1, idempotencyKey: 1 },
    { name: 'patientId_1_idempotencyKey_1', unique: true, sparse: true },
  );
}
