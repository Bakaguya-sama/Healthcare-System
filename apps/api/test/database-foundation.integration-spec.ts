import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { migrateDatabase } from '../src/database/migrations/run-migrations';
import { seedDemoData } from '../src/database/seeds/demo.seed';
import {
  REFERENCE_BLACKLIST_KEYWORDS,
  seedReferenceData,
} from '../src/database/seeds/reference.seed';
import { verifyDatabase } from '../src/database/verify-database';

const baseUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://localhost:27017/healthcare_rf4_test?replicaSet=rs0&directConnection=true';
const databaseName = `healthcare_rf4_${randomUUID().replaceAll('-', '')}`;
const uri = new URL(baseUri);
uri.pathname = `/${databaseName}`;

describe('RF-4 database foundation', () => {
  const client = new MongoClient(uri.toString());

  beforeAll(async () => client.connect());
  afterAll(async () => {
    await client.db().dropDatabase();
    await client.close();
  });

  it('migrates an empty database, verifies it and makes the second run a no-op', async () => {
    const first = await migrateDatabase(client.db());
    const second = await migrateDatabase(client.db());
    const verification = await verifyDatabase(
      client.db(),
      first.currentVersion,
    );

    expect(first.applied).toHaveLength(1);
    expect(second.applied).toHaveLength(0);
    expect(second.skipped).toEqual(first.applied);
    expect(verification.currentVersion).toBe(first.currentVersion);
    expect(
      await client.db().collection('_migration_lock').countDocuments(),
    ).toBe(0);
  });

  it('rolls back all writes when a transaction fails', async () => {
    const collection = client.db().collection('_transaction_proof');
    const session = client.startSession();
    await expect(
      session.withTransaction(async () => {
        await collection.insertMany([{ step: 1 }, { step: 2 }], { session });
        throw new Error('intentional rollback');
      }),
    ).rejects.toThrow('intentional rollback');
    await session.endSession();

    expect(await collection.countDocuments()).toBe(0);
  });

  it('applies reference and demo seeds idempotently', async () => {
    await seedReferenceData(client.db());
    await seedReferenceData(client.db());
    await seedDemoData(client.db());
    await seedDemoData(client.db());

    expect(
      await client
        .db()
        .collection('blacklistkeywords')
        .countDocuments({
          keyword: { $in: [...REFERENCE_BLACKLIST_KEYWORDS] },
        }),
    ).toBe(REFERENCE_BLACKLIST_KEYWORDS.length);
    expect(
      await client
        .db()
        .collection('users')
        .countDocuments({
          email: {
            $in: [
              'patient.demo@healthcare.local',
              'admin.demo@healthcare.local',
            ],
          },
        }),
    ).toBe(2);
  });
});
