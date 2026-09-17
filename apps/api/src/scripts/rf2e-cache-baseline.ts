import { createKeyv } from '@keyv/redis';
import { createCache } from 'cache-manager';
import { Db, MongoClient, ObjectId } from 'mongodb';
import { performance } from 'node:perf_hooks';
import { CacheManagerAdapter } from '../common/cache/cache-manager.adapter';
import { DOCTOR_DIRECTORY_CACHE_POLICY } from '../modules/users/users-cache.service';

const DEFAULT_MONGODB_URI =
  'mongodb://localhost:27017/healthcare_rf2e_perf?replicaSet=rs0&directConnection=true';
const DEFAULT_REDIS_URI = 'redis://127.0.0.1:16379';
const SAMPLE_COUNT = 25;
const DIRECTORY_LIMIT = 100;

type DirectoryEntry = {
  id: string;
  fullName: string;
  specialty?: string;
};

function percentile(samples: number[], ratio: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
  return Number(sorted[index].toFixed(3));
}

async function seedDirectory(db: Db): Promise<void> {
  const userIds = Array.from({ length: 2_000 }, () => new ObjectId());
  await db.collection('users').insertMany(
    userIds.map((id, index) => ({
      _id: id,
      fullName: `Doctor ${index}`,
      role: 'doctor',
      accountStatus: index % 10 === 0 ? 'banned' : 'active',
    })),
  );
  await db.collection('doctors').insertMany(
    userIds.map((userId, index) => ({
      userId,
      specialty: `specialty-${index % 20}`,
      verificationStatus: index % 4 === 0 ? 'pending' : 'approved',
    })),
  );
  await db
    .collection('doctors')
    .createIndex({ verificationStatus: 1, userId: 1 });
}

function createDirectoryLoader(db: Db, onQuery: () => void) {
  return async (): Promise<DirectoryEntry[]> => {
    onQuery();
    const doctors = await db
      .collection('doctors')
      .find({ verificationStatus: 'approved' })
      .project<{ userId: ObjectId; specialty: string }>({
        _id: 0,
        userId: 1,
        specialty: 1,
      })
      .sort({ userId: 1 })
      .limit(DIRECTORY_LIMIT)
      .toArray();
    const specialtyByUser = new Map(
      doctors.map((doctor) => [doctor.userId.toHexString(), doctor.specialty]),
    );
    const users = await db
      .collection('users')
      .find({
        _id: { $in: doctors.map((doctor) => doctor.userId) },
        role: 'doctor',
        accountStatus: 'active',
      })
      .project<{ _id: ObjectId; fullName: string }>({ fullName: 1 })
      .sort({ _id: 1 })
      .limit(DIRECTORY_LIMIT)
      .toArray();

    return users.map((user) => ({
      id: user._id.toHexString(),
      fullName: user.fullName,
      specialty: specialtyByUser.get(user._id.toHexString()),
    }));
  };
}

async function measure(operation: () => Promise<unknown>): Promise<number[]> {
  const samples: number[] = [];
  for (let iteration = 0; iteration < SAMPLE_COUNT; iteration += 1) {
    const startedAt = performance.now();
    await operation();
    samples.push(performance.now() - startedAt);
  }
  return samples;
}

async function main(): Promise<void> {
  const mongoClient = new MongoClient(
    process.env.RF2E_MONGODB_URI ?? DEFAULT_MONGODB_URI,
  );
  await mongoClient.connect();
  const databaseName = `healthcare_rf2e_perf_${new ObjectId().toHexString()}`;
  const db = mongoClient.db(databaseName);
  const redisStore = createKeyv(
    process.env.RF2E_REDIS_URL ?? DEFAULT_REDIS_URI,
    { namespace: `healthcare-rf2e-perf-${new ObjectId().toHexString()}` },
  );
  const cache = createCache({ stores: [redisStore] });

  try {
    await seedDirectory(db);

    let uncachedDatabaseLoads = 0;
    const uncachedLoader = createDirectoryLoader(
      db,
      () => (uncachedDatabaseLoads += 1),
    );
    const uncachedSamples = await measure(uncachedLoader);

    let cachedDatabaseLoads = 0;
    const cachedLoader = createDirectoryLoader(
      db,
      () => (cachedDatabaseLoads += 1),
    );
    const adapter = new CacheManagerAdapter(cache);
    const cachedSamples = await measure(() =>
      adapter.getOrSet(
        DOCTOR_DIRECTORY_CACHE_POLICY.key,
        DOCTOR_DIRECTORY_CACHE_POLICY.ttlMs,
        cachedLoader,
      ),
    );
    const metrics = adapter.getMetrics();

    if (cachedDatabaseLoads !== 1 || metrics.hitRate < 0.9) {
      throw new Error(
        `Cache benefit gate failed: loads=${cachedDatabaseLoads}, hitRate=${metrics.hitRate}`,
      );
    }

    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          database: databaseName,
          dataset: { doctors: 2_000, directoryLimit: DIRECTORY_LIMIT },
          samples: SAMPLE_COUNT,
          uncached: {
            databaseLoads: uncachedDatabaseLoads,
            latencyP50Ms: percentile(uncachedSamples, 0.5),
            latencyP95Ms: percentile(uncachedSamples, 0.95),
          },
          cached: {
            databaseLoads: cachedDatabaseLoads,
            databaseLoadReduction:
              1 - cachedDatabaseLoads / uncachedDatabaseLoads,
            latencyP50Ms: percentile(cachedSamples, 0.5),
            latencyP95Ms: percentile(cachedSamples, 0.95),
            metrics,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await cache.clear();
    await cache.disconnect();
    await db.dropDatabase();
    await mongoClient.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
