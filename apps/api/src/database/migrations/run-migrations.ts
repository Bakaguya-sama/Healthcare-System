import { MongoClient } from 'mongodb';
import {
  applyRf2dQueryIndexes,
  RF2D_QUERY_INDEX_MIGRATION_ID,
} from './202609162200-rf2d-query-indexes';

type Migration = {
  id: string;
  up: typeof applyRf2dQueryIndexes;
};

const migrations: readonly Migration[] = [
  {
    id: RF2D_QUERY_INDEX_MIGRATION_ID,
    up: applyRf2dQueryIndexes,
  },
];

async function runMigrations(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required to run database migrations');
  }

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db();
    const migrationCollection = db.collection<{
      id: string;
      appliedAt: Date;
    }>('_migrations');
    await migrationCollection.createIndex({ id: 1 }, { unique: true });

    for (const migration of migrations) {
      const applied = await migrationCollection.findOne({ id: migration.id });
      if (applied) {
        console.log(`skip ${migration.id} (already applied)`);
        continue;
      }

      await migration.up(db);
      await migrationCollection.insertOne({
        id: migration.id,
        appliedAt: new Date(),
      });
      console.log(`applied ${migration.id}`);
    }
  } finally {
    await client.close();
  }
}

void runMigrations().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
