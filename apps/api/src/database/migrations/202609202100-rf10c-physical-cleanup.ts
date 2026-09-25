import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';
import { assertRf10cReady, reconcileRf10c } from './rf10c-reconciliation';

export const RF10C_PHYSICAL_CLEANUP_VERSION = 202609202100;
export const RF10C_PHYSICAL_CLEANUP_NAME = 'rf10c-physical-cleanup';
export const RF10C_PHYSICAL_CLEANUP_CHECKSUM = migrationChecksum({
  version: RF10C_PHYSICAL_CLEANUP_VERSION,
  name: RF10C_PHYSICAL_CLEANUP_NAME,
  steps: [
    'assert-canonical-reconciliation',
    'drop-retired-collections',
    'drop-legacy-indexes',
    'unset-legacy-link-fields',
  ],
});

async function collectionExists(db: Db, name: string): Promise<boolean> {
  return db.listCollections({ name }, { nameOnly: true }).hasNext();
}

async function dropIndexesUsingFields(
  db: Db,
  collection: string,
  fields: string[],
): Promise<void> {
  if (!(await collectionExists(db, collection))) return;
  const indexes = await db.collection(collection).listIndexes().toArray();
  for (const index of indexes) {
    if (
      index.name &&
      index.name !== '_id_' &&
      Object.keys(index.key).some((field) => fields.includes(field))
    ) {
      await db.collection(collection).dropIndex(index.name);
    }
  }
}

async function unsetIfCollectionExists(
  db: Db,
  collection: string,
  fields: string[],
): Promise<void> {
  if (!(await collectionExists(db, collection))) return;
  await db.collection(collection).updateMany(
    {},
    {
      $unset: Object.fromEntries(fields.map((field) => [field, ''])),
    },
  );
}

async function dropCollectionIfExists(db: Db, name: string): Promise<void> {
  if (await collectionExists(db, name)) await db.collection(name).drop();
}

export async function applyRf10cPhysicalCleanup(db: Db): Promise<void> {
  const report = await reconcileRf10c(db);
  assertRf10cReady(report);

  // Drop fully reconciled source collections before removing provenance fields.
  // If the process stops between collections, the remaining sources still have
  // their canonical lookup keys and the migration can safely reconcile again.
  for (const collection of [
    'sessions',
    'aisessions',
    'aimessages',
    'aihealthinsights',
  ]) {
    await dropCollectionIfExists(db, collection);
  }

  await Promise.all([
    dropIndexesUsingFields(db, 'messages', ['doctorSessionId']),
    dropIndexesUsingFields(db, 'aifeedbacks', ['aiSessionId']),
    dropIndexesUsingFields(db, 'aiconversations', ['legacyAiSessionId']),
    dropIndexesUsingFields(db, 'aiconversationmessages', ['legacySourceKey']),
  ]);

  await Promise.all([
    unsetIfCollectionExists(db, 'messages', ['doctorSessionId']),
    unsetIfCollectionExists(db, 'reviews', ['doctorSessionId']),
    unsetIfCollectionExists(db, 'aifeedbacks', ['aiSessionId']),
    unsetIfCollectionExists(db, 'aiconversations', ['legacyAiSessionId']),
    unsetIfCollectionExists(db, 'aiconversationmessages', ['legacySourceKey']),
  ]);
}
