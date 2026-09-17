import type { Db, Document } from 'mongodb';
import { RF2D_QUERY_INDEXES } from './migrations/202609162200-rf2d-query-indexes';

export const SCHEMA_MIGRATIONS_COLLECTION = '_schema_migrations';
export const MIGRATION_LOCK_COLLECTION = '_migration_lock';

export const INFRASTRUCTURE_COLLECTIONS: ReadonlyArray<{
  name: string;
  validator: Document;
}> = [
  {
    name: SCHEMA_MIGRATIONS_COLLECTION,
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['version', 'name', 'checksum', 'status', 'startedAt'],
        properties: {
          version: { bsonType: 'double' },
          name: { bsonType: 'string' },
          checksum: { bsonType: 'string' },
          status: { enum: ['running', 'applied', 'failed'] },
          startedAt: { bsonType: 'date' },
          appliedAt: { bsonType: 'date' },
          failedAt: { bsonType: 'date' },
          error: { bsonType: 'string' },
        },
      },
    },
  },
  {
    name: MIGRATION_LOCK_COLLECTION,
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['owner', 'expiresAt'],
        properties: {
          owner: { bsonType: 'string' },
          expiresAt: { bsonType: 'date' },
        },
      },
    },
  },
];

export const MANAGED_DATABASE_INDEXES = [
  {
    collection: SCHEMA_MIGRATIONS_COLLECTION,
    name: 'version_1',
    key: { version: 1 },
    unique: true,
  },
  {
    collection: SCHEMA_MIGRATIONS_COLLECTION,
    name: 'name_1',
    key: { name: 1 },
    unique: true,
  },
  {
    collection: MIGRATION_LOCK_COLLECTION,
    name: 'expiresAt_1',
    key: { expiresAt: 1 },
    expireAfterSeconds: 0,
  },
  ...RF2D_QUERY_INDEXES,
] as const;

export async function ensureInfrastructureCollections(db: Db): Promise<void> {
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (collection) => collection.name,
    ),
  );

  for (const collection of INFRASTRUCTURE_COLLECTIONS) {
    if (!existing.has(collection.name)) {
      await db.createCollection(collection.name, {
        validator: collection.validator,
        validationLevel: 'strict',
        validationAction: 'error',
      });
    } else {
      await db.command({
        collMod: collection.name,
        validator: collection.validator,
        validationLevel: 'strict',
        validationAction: 'error',
      });
    }
  }

  await db
    .collection(SCHEMA_MIGRATIONS_COLLECTION)
    .createIndex({ version: 1 }, { name: 'version_1', unique: true });
  await db
    .collection(SCHEMA_MIGRATIONS_COLLECTION)
    .createIndex({ name: 1 }, { name: 'name_1', unique: true });
  await db
    .collection(MIGRATION_LOCK_COLLECTION)
    .createIndex(
      { expiresAt: 1 },
      { name: 'expiresAt_1', expireAfterSeconds: 0 },
    );
}
