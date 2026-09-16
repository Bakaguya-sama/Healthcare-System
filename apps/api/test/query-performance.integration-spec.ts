import { Db, Document, MongoClient, ObjectId } from 'mongodb';
import {
  applyRf2dQueryIndexes,
  RF2D_QUERY_INDEXES,
} from '../src/database/migrations/202609162200-rf2d-query-indexes';

jest.setTimeout(30_000);

const mongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://localhost:27017/healthcare_rf1_test?replicaSet=rs0&directConnection=true';

type PerformanceQuery = {
  collection: string;
  filter: Document;
  sort: Record<string, 1 | -1>;
  index: string;
};

function collectStages(
  value: unknown,
  stages = new Set<string>(),
): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectStages(item, stages);
    return stages;
  }
  if (!value || typeof value !== 'object') return stages;

  const document = value as Record<string, unknown>;
  if (typeof document.stage === 'string') stages.add(document.stage);
  for (const nested of Object.values(document)) collectStages(nested, stages);
  return stages;
}

describe('RF-2D managed query indexes', () => {
  let client: MongoClient;
  let db: Db;
  let performanceQueries: PerformanceQuery[];

  beforeAll(async () => {
    client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5_000 });
    await client.connect();
    db = client.db(`healthcare_rf2d_test_${new ObjectId().toHexString()}`);
    await applyRf2dQueryIndexes(db);

    const patientId = new ObjectId();
    const doctorId = new ObjectId();
    const sessionId = new ObjectId();
    const baseTime = Date.UTC(2026, 0, 1);

    await Promise.all([
      db.collection('doctors').insertMany(
        Array.from({ length: 500 }, (_, index) => ({
          userId: index === 0 ? doctorId : new ObjectId(),
          verificationStatus: index % 2 === 0 ? 'approved' : 'pending',
        })),
      ),
      db.collection('sessions').insertMany(
        Array.from({ length: 1_000 }, (_, index) => ({
          patientId: index % 5 === 0 ? patientId : new ObjectId(),
          doctorId: index % 5 === 0 ? doctorId : new ObjectId(),
          status: index % 2 === 0 ? 'pending' : 'completed',
          scheduledAt: new Date(baseTime + index * 60_000),
        })),
      ),
      db.collection('messages').insertMany(
        Array.from({ length: 1_000 }, (_, index) => ({
          doctorSessionId: index % 5 === 0 ? sessionId : new ObjectId(),
          senderId: patientId,
          senderType: 'patient',
          content: `message-${index}`,
          sentAt: new Date(baseTime + index * 1_000),
        })),
      ),
      db.collection('healthmetrics').insertMany(
        Array.from({ length: 1_000 }, (_, index) => ({
          patientId: index % 5 === 0 ? patientId : new ObjectId(),
          type: index % 2 === 0 ? 'heart_rate' : 'weight',
          values: { value: { value: 80 } },
          unit: 'bpm',
          recordedAt: new Date(baseTime + index * 60_000),
        })),
      ),
      db.collection('notifications').insertMany(
        Array.from({ length: 1_000 }, (_, index) => ({
          userId: index % 5 === 0 ? patientId : new ObjectId(),
          type: 'info',
          title: `notification-${index}`,
          message: 'query performance fixture',
          isRead: index % 2 !== 0,
          createdAt: new Date(baseTime + index * 30_000),
        })),
      ),
      db.collection('aiconversations').insertMany(
        Array.from({ length: 1_000 }, (_, index) => ({
          userId: index % 5 === 0 ? patientId : new ObjectId(),
          type: 'health_inquiry',
          topic: `topic-${index}`,
          status: 'active',
          isArchived: index % 2 !== 0,
          createdAt: new Date(baseTime + index * 45_000),
        })),
      ),
    ]);

    performanceQueries = [
      {
        collection: 'doctors',
        filter: { verificationStatus: 'approved' },
        sort: { userId: 1 },
        index: 'verificationStatus_1_userId_1',
      },
      {
        collection: 'sessions',
        filter: { patientId, status: 'pending' },
        sort: { scheduledAt: -1, _id: -1 },
        index: 'patientId_1_status_1_scheduledAt_-1__id_-1',
      },
      {
        collection: 'sessions',
        filter: { doctorId },
        sort: { scheduledAt: -1, _id: -1 },
        index: 'doctorId_1_scheduledAt_-1__id_-1',
      },
      {
        collection: 'messages',
        filter: { doctorSessionId: sessionId },
        sort: { sentAt: -1, _id: -1 },
        index: 'doctorSessionId_1_sentAt_-1__id_-1',
      },
      {
        collection: 'healthmetrics',
        filter: { patientId, type: 'heart_rate' },
        sort: { recordedAt: -1, _id: -1 },
        index: 'patientId_1_type_1_recordedAt_-1__id_-1',
      },
      {
        collection: 'notifications',
        filter: { userId: patientId, isRead: false },
        sort: { createdAt: -1, _id: -1 },
        index: 'userId_1_isRead_1_createdAt_-1__id_-1',
      },
      {
        collection: 'aiconversations',
        filter: { userId: patientId },
        sort: { createdAt: -1, _id: -1 },
        index: 'userId_1_createdAt_-1__id_-1',
      },
      {
        collection: 'aiconversations',
        filter: { userId: patientId, isArchived: false },
        sort: { createdAt: -1, _id: -1 },
        index: 'userId_1_isArchived_1_createdAt_-1__id_-1',
      },
    ];
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it('applies every versioned index idempotently', async () => {
    await applyRf2dQueryIndexes(db);

    const indexesByCollection = new Map<string, Set<string>>();
    for (const index of RF2D_QUERY_INDEXES) {
      if (!indexesByCollection.has(index.collection)) {
        const indexes = await db
          .collection(index.collection)
          .listIndexes()
          .toArray();
        const indexNames = new Set<string>();
        for (const item of indexes) {
          const itemRecord = item as Record<string, unknown>;
          if (typeof itemRecord.name === 'string') {
            indexNames.add(itemRecord.name);
          }
        }
        indexesByCollection.set(index.collection, indexNames);
      }
      expect(indexesByCollection.get(index.collection)).toContain(index.name);
    }
  });

  it('uses every P0 index without COLLSCAN or blocking SORT', async () => {
    for (const queryCase of performanceQueries) {
      const explain = await db
        .collection(queryCase.collection)
        .find(queryCase.filter)
        .sort(queryCase.sort)
        .limit(20)
        .hint(queryCase.index)
        .explain('executionStats');
      const explainRecord = explain as Record<string, unknown>;
      const queryPlanner =
        explainRecord.queryPlanner &&
        typeof explainRecord.queryPlanner === 'object'
          ? (explainRecord.queryPlanner as Record<string, unknown>)
          : {};
      const executionStats =
        explainRecord.executionStats &&
        typeof explainRecord.executionStats === 'object'
          ? (explainRecord.executionStats as Record<string, unknown>)
          : {};
      const stages = collectStages(queryPlanner.winningPlan);

      expect(stages).toContain('IXSCAN');
      expect(stages).not.toContain('COLLSCAN');
      expect(stages).not.toContain('SORT');
      const keysExamined = executionStats.totalKeysExamined;
      const docsExamined = executionStats.totalDocsExamined;
      if (
        typeof keysExamined !== 'number' ||
        typeof docsExamined !== 'number'
      ) {
        throw new Error('Explain output is missing execution counters');
      }
      expect(keysExamined).toBeLessThanOrEqual(20);
      expect(docsExamined).toBeLessThanOrEqual(20);
    }
  });
});
