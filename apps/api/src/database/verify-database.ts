import { isDeepStrictEqual } from 'node:util';
import { MongoClient, type Db } from 'mongodb';
import { DATABASE_MIGRATIONS } from './migrations/migration-registry';
import {
  INFRASTRUCTURE_COLLECTIONS,
  MANAGED_DATABASE_INDEXES,
  SCHEMA_MIGRATIONS_COLLECTION,
} from './schema-manifest';

export type DatabaseVerificationResult = {
  currentVersion: number;
  collections: number;
  indexes: number;
};

type ManagedIndexInfo = {
  name?: string;
  key: Record<string, unknown>;
  unique?: boolean;
  expireAfterSeconds?: number;
};

export async function verifyDatabase(
  db: Db,
  minimumVersion = 0,
): Promise<DatabaseVerificationResult> {
  const errors: string[] = [];
  const collectionInfo = await db.listCollections().toArray();
  const collections = new Map(
    collectionInfo.map((collection) => [collection.name, collection]),
  );

  for (const expected of INFRASTRUCTURE_COLLECTIONS) {
    const actual = collections.get(expected.name);
    if (!actual) {
      errors.push(`missing collection ${expected.name}`);
      continue;
    }
    const options = 'options' in actual ? actual.options : undefined;
    if (!isDeepStrictEqual(options?.validator, expected.validator)) {
      errors.push(`validator drift on ${expected.name}`);
    }
  }

  for (const expected of MANAGED_DATABASE_INDEXES) {
    if (!collections.has(expected.collection)) {
      errors.push(`missing indexed collection ${expected.collection}`);
      continue;
    }
    const indexes = (await db
      .collection(expected.collection)
      .listIndexes()
      .toArray()) as ManagedIndexInfo[];
    const actual = indexes.find((index) => index.name === expected.name);
    if (!actual) {
      errors.push(`missing index ${expected.collection}.${expected.name}`);
      continue;
    }
    if (!isDeepStrictEqual(actual.key, expected.key)) {
      errors.push(`index key drift on ${expected.collection}.${expected.name}`);
    }
    if ('unique' in expected && actual.unique !== expected.unique) {
      errors.push(
        `index unique drift on ${expected.collection}.${expected.name}`,
      );
    }
    if (
      'expireAfterSeconds' in expected &&
      actual.expireAfterSeconds !== expected.expireAfterSeconds
    ) {
      errors.push(`index TTL drift on ${expected.collection}.${expected.name}`);
    }
  }

  const records = await db
    .collection<{
      version: number;
      name: string;
      checksum: string;
      status: string;
    }>(SCHEMA_MIGRATIONS_COLLECTION)
    .find()
    .toArray();
  const recordByVersion = new Map(
    records.map((record) => [record.version, record]),
  );

  for (const migration of DATABASE_MIGRATIONS) {
    const record = recordByVersion.get(migration.version);
    if (!record) {
      errors.push(
        `migration ${migration.version}-${migration.name} is not recorded`,
      );
    } else if (record.status !== 'applied') {
      errors.push(
        `migration ${migration.version}-${migration.name} is ${record.status}`,
      );
    } else if (
      record.name !== migration.name ||
      record.checksum !== migration.checksum
    ) {
      errors.push(`migration metadata drift on ${migration.version}`);
    }
  }

  const currentVersion = records
    .filter((record) => record.status === 'applied')
    .reduce((latest, record) => Math.max(latest, record.version), 0);
  if (currentVersion < minimumVersion) {
    errors.push(
      `schema version ${currentVersion} is below required ${minimumVersion}`,
    );
  }
  if (errors.length > 0) {
    throw new Error(`Database verification failed:\n- ${errors.join('\n- ')}`);
  }

  return {
    currentVersion,
    collections: collections.size,
    indexes: MANAGED_DATABASE_INDEXES.length,
  };
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required to verify the database');
  const minimum = Number(process.env.MIN_SCHEMA_VERSION ?? 0);
  if (!Number.isSafeInteger(minimum) || minimum < 0) {
    throw new Error('MIN_SCHEMA_VERSION must be a non-negative safe integer');
  }

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const result = await verifyDatabase(client.db(), minimum);
    console.log(
      `database verified: version=${result.currentVersion}, collections=${result.collections}, managedIndexes=${result.indexes}`,
    );
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
