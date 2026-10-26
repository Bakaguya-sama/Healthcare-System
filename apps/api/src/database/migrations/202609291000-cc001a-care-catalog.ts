import type { Db, Document } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const CC001A_CARE_CATALOG_VERSION = 202609291000;
export const CC001A_CARE_CATALOG_NAME = 'cc001a-care-catalog';
export const CC001A_CARE_CATALOG_CHECKSUM = migrationChecksum({
  version: CC001A_CARE_CATALOG_VERSION,
  name: CC001A_CARE_CATALOG_NAME,
  steps: ['backfill-catalog-revisions', 'create-care-command-idempotencies'],
});

export const CC001A_COLLECTIONS: ReadonlyArray<{
  name: string;
  validator: Document;
}> = [
  {
    name: 'carecommandidempotencies',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: [
          'actorId',
          'operation',
          'key',
          'requestHash',
          'entityType',
          'entityId',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          actorId: { bsonType: 'objectId' },
          operation: { bsonType: 'string' },
          key: { bsonType: 'string' },
          requestHash: { bsonType: 'string' },
          entityType: { enum: ['careProgram', 'careRule'] },
          entityId: { bsonType: 'objectId' },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
  },
];

export const CC001A_INDEXES = [
  {
    collection: 'carecommandidempotencies',
    name: 'actorId_1_operation_1_key_1',
    key: { actorId: 1, operation: 1, key: 1 },
    unique: true,
  },
] as const;

async function ensureCollection(
  db: Db,
  definition: { name: string; validator: Document },
): Promise<void> {
  const exists = await db
    .listCollections({ name: definition.name }, { nameOnly: true })
    .hasNext();
  if (!exists) {
    await db.createCollection(definition.name, {
      validator: definition.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  } else {
    await db.command({
      collMod: definition.name,
      validator: definition.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  }
}

export async function applyCc001aCareCatalog(db: Db): Promise<void> {
  await db
    .collection('careprograms')
    .updateMany({ revision: { $exists: false } }, { $set: { revision: 1 } });
  await db
    .collection('carerules')
    .updateMany({ revision: { $exists: false } }, { $set: { revision: 1 } });
  for (const collection of CC001A_COLLECTIONS)
    await ensureCollection(db, collection);
  for (const index of CC001A_INDEXES)
    await db
      .collection(index.collection)
      .createIndex(index.key, { name: index.name, unique: index.unique });
}
