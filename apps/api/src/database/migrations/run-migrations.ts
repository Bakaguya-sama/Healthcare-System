import { randomUUID } from 'node:crypto';
import { MongoClient, type Db } from 'mongodb';
import {
  ensureInfrastructureCollections,
  MIGRATION_LOCK_COLLECTION,
  SCHEMA_MIGRATIONS_COLLECTION,
} from '../schema-manifest';
import { DATABASE_MIGRATIONS } from './migration-registry';

type MigrationRecord = {
  version: number;
  name: string;
  checksum: string;
  status: 'running' | 'applied' | 'failed';
  startedAt: Date;
  appliedAt?: Date;
  failedAt?: Date;
  error?: string;
};

export type MigrationRunResult = {
  applied: string[];
  skipped: string[];
  currentVersion: number;
};

const LOCK_ID = 'database-migrations';
const LOCK_TTL_MS = 5 * 60_000;
type MigrationLock = { _id: string; owner: string; expiresAt: Date };

function validateMigrationRegistry(): void {
  let previousVersion = 0;
  const names = new Set<string>();
  for (const migration of DATABASE_MIGRATIONS) {
    if (
      !Number.isSafeInteger(migration.version) ||
      migration.version <= previousVersion
    ) {
      throw new Error(
        'Migration versions must be unique safe integers in ascending order',
      );
    }
    if (names.has(migration.name)) {
      throw new Error(`Duplicate migration name ${migration.name}`);
    }
    if (!/^[a-f0-9]{64}$/.test(migration.checksum)) {
      throw new Error(`Invalid checksum for migration ${migration.version}`);
    }
    previousVersion = migration.version;
    names.add(migration.name);
  }
}

async function acquireLock(db: Db, owner: string): Promise<void> {
  const now = new Date();
  try {
    const lock = await db
      .collection<MigrationLock>(MIGRATION_LOCK_COLLECTION)
      .findOneAndUpdate(
        {
          _id: LOCK_ID,
          $or: [{ expiresAt: { $lte: now } }, { owner }],
        },
        {
          $set: { owner, expiresAt: new Date(now.getTime() + LOCK_TTL_MS) },
        },
        { upsert: true, returnDocument: 'after' },
      );
    if (lock?.owner !== owner)
      throw new Error('Migration lock was not acquired');
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    ) {
      throw new Error('Another database migration process holds the lock');
    }
    throw error;
  }
}

async function releaseLock(db: Db, owner: string): Promise<void> {
  await db.collection<MigrationLock>(MIGRATION_LOCK_COLLECTION).deleteOne({
    _id: LOCK_ID,
    owner,
  });
}

export async function migrateDatabase(db: Db): Promise<MigrationRunResult> {
  validateMigrationRegistry();
  await ensureInfrastructureCollections(db);
  const owner = randomUUID();
  await acquireLock(db, owner);
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    const records = db.collection<MigrationRecord>(
      SCHEMA_MIGRATIONS_COLLECTION,
    );
    for (const migration of DATABASE_MIGRATIONS) {
      const existing = await records.findOne({ version: migration.version });
      if (existing?.status === 'applied') {
        if (existing.name !== migration.name) {
          throw new Error(
            `Migration version ${migration.version} changed name from ${existing.name} to ${migration.name}`,
          );
        }
        if (existing.checksum !== migration.checksum) {
          throw new Error(
            `Migration ${migration.version}-${migration.name} checksum changed after being applied`,
          );
        }
        skipped.push(`${migration.version}-${migration.name}`);
        continue;
      }

      await records.updateOne(
        { version: migration.version },
        {
          $set: {
            name: migration.name,
            checksum: migration.checksum,
            status: 'running',
            startedAt: new Date(),
          },
          $unset: { appliedAt: '', failedAt: '', error: '' },
        },
        { upsert: true },
      );

      try {
        await migration.up(db);
        await records.updateOne(
          { version: migration.version },
          { $set: { status: 'applied', appliedAt: new Date() } },
        );
        applied.push(`${migration.version}-${migration.name}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        await records.updateOne(
          { version: migration.version },
          {
            $set: { status: 'failed', failedAt: new Date(), error: message },
          },
        );
        throw error;
      }
    }

    const latest = await records
      .find({ status: 'applied' })
      .sort({ version: -1 })
      .limit(1)
      .next();
    return { applied, skipped, currentVersion: latest?.version ?? 0 };
  } finally {
    await releaseLock(db, owner);
  }
}

export async function runMigrations(uri: string): Promise<MigrationRunResult> {
  const client = new MongoClient(uri);
  await client.connect();
  try {
    return await migrateDatabase(client.db());
  } finally {
    await client.close();
  }
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required to run migrations');
  const result = await runMigrations(uri);
  const expectNoop = process.argv.includes('--expect-noop');
  if (expectNoop && result.applied.length > 0) {
    throw new Error(
      `Expected migration no-op, applied: ${result.applied.join(', ')}`,
    );
  }

  for (const migration of result.applied) console.log(`applied ${migration}`);
  for (const migration of result.skipped) console.log(`skip ${migration}`);
  console.log(`schema version ${result.currentVersion}`);
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
