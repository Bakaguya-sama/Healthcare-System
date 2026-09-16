import { Collection, Db, Document, MongoClient, ObjectId } from 'mongodb';
import { performance } from 'node:perf_hooks';
import { applyRf2dQueryIndexes } from '../database/migrations/202609162200-rf2d-query-indexes';

type QueryCase = {
  id: string;
  collection: string;
  filter: Document;
  sort: Record<string, 1 | -1>;
  index: string;
};

type ExplainSummary = {
  stages: string[];
  indexNames: string[];
  nReturned: number;
  keysExamined: number;
  docsExamined: number;
  executionTimeMillis: number;
  latencyP95Millis: number;
};

const DEFAULT_URI =
  'mongodb://localhost:27017/healthcare_rf2d_perf?replicaSet=rs0&directConnection=true';
const PAGE_LIMIT = 20;

function collectPlanValues(
  value: unknown,
  key: 'stage' | 'indexName',
  result: Set<string>,
): void {
  if (Array.isArray(value)) {
    for (const item of value) collectPlanValues(item, key, result);
    return;
  }

  if (!value || typeof value !== 'object') return;
  const document = value as Record<string, unknown>;
  if (typeof document[key] === 'string') result.add(document[key]);
  for (const nested of Object.values(document)) {
    collectPlanValues(nested, key, result);
  }
}

function summarizeExplain(explain: Document): ExplainSummary {
  const stages = new Set<string>();
  const indexNames = new Set<string>();
  const explainRecord = explain as Record<string, unknown>;
  const queryPlanner =
    explainRecord.queryPlanner && typeof explainRecord.queryPlanner === 'object'
      ? (explainRecord.queryPlanner as Record<string, unknown>)
      : {};
  collectPlanValues(queryPlanner.winningPlan, 'stage', stages);
  collectPlanValues(queryPlanner.winningPlan, 'indexName', indexNames);

  const stats =
    explainRecord.executionStats &&
    typeof explainRecord.executionStats === 'object'
      ? (explainRecord.executionStats as Record<string, number>)
      : {};
  return {
    stages: [...stages],
    indexNames: [...indexNames],
    nReturned: stats.nReturned ?? 0,
    keysExamined: stats.totalKeysExamined ?? 0,
    docsExamined: stats.totalDocsExamined ?? 0,
    executionTimeMillis: stats.executionTimeMillis ?? 0,
    latencyP95Millis: 0,
  };
}

async function measureP95(db: Db, queryCase: QueryCase): Promise<number> {
  const samples: number[] = [];
  for (let iteration = 0; iteration < 25; iteration += 1) {
    const startedAt = performance.now();
    await db
      .collection(queryCase.collection)
      .find(queryCase.filter)
      .sort(queryCase.sort)
      .limit(PAGE_LIMIT)
      .toArray();
    samples.push(performance.now() - startedAt);
  }

  samples.sort((left, right) => left - right);
  const p95Index = Math.ceil(samples.length * 0.95) - 1;
  return Number(samples[p95Index].toFixed(3));
}

async function insertInChunks(
  collection: Collection<Document>,
  documents: Document[],
): Promise<void> {
  for (let offset = 0; offset < documents.length; offset += 1_000) {
    await collection.insertMany(documents.slice(offset, offset + 1_000));
  }
}

async function seedRepresentativeData(db: Db): Promise<{
  queryCases: QueryCase[];
  cardinality: Record<string, number>;
}> {
  const baseTime = Date.UTC(2026, 0, 1);
  const patientIds = Array.from({ length: 40 }, () => new ObjectId());
  const doctorIds = Array.from({ length: 40 }, () => new ObjectId());
  const sessionIds = Array.from({ length: 100 }, () => new ObjectId());

  const doctors = Array.from({ length: 2_000 }, (_, index) => ({
    userId: index < 40 ? doctorIds[index] : new ObjectId(),
    verificationStatus: index % 4 === 0 ? 'pending' : 'approved',
    specialty: `specialty-${index % 20}`,
  }));
  const sessions = Array.from({ length: 12_000 }, (_, index) => ({
    patientId: patientIds[index % patientIds.length],
    doctorId: doctorIds[index % doctorIds.length],
    status: index % 3 === 0 ? 'completed' : 'pending',
    scheduledAt: new Date(baseTime + index * 60_000),
  }));
  const messages = Array.from({ length: 20_000 }, (_, index) => ({
    doctorSessionId: sessionIds[index % sessionIds.length],
    senderId: patientIds[index % patientIds.length],
    senderType: 'patient',
    content: `message-${index}`,
    sentAt: new Date(baseTime + index * 1_000),
  }));
  const healthMetrics = Array.from({ length: 12_000 }, (_, index) => ({
    patientId: patientIds[index % patientIds.length],
    type: index % 2 === 0 ? 'heart_rate' : 'weight',
    values: { value: { value: 60 + (index % 40) } },
    unit: index % 2 === 0 ? 'bpm' : 'kg',
    recordedAt: new Date(baseTime + index * 60_000),
  }));
  const notifications = Array.from({ length: 12_000 }, (_, index) => ({
    userId: patientIds[index % patientIds.length],
    type: index % 5 === 0 ? 'warning' : 'info',
    title: `notification-${index}`,
    message: 'Representative notification',
    isRead: index % 3 === 0,
    createdAt: new Date(baseTime + index * 30_000),
    updatedAt: new Date(baseTime + index * 30_000),
  }));
  const conversations = Array.from({ length: 8_000 }, (_, index) => ({
    userId: patientIds[index % patientIds.length],
    type: index % 2 === 0 ? 'health_inquiry' : 'general_consultation',
    topic: `health topic ${index}`,
    status: index % 4 === 0 ? 'completed' : 'active',
    isArchived: index % 5 === 0,
    isFavorite: index % 7 === 0,
    createdAt: new Date(baseTime + index * 45_000),
    updatedAt: new Date(baseTime + index * 45_000),
  }));

  await insertInChunks(db.collection('doctors'), doctors);
  await insertInChunks(db.collection('sessions'), sessions);
  await insertInChunks(db.collection('messages'), messages);
  await insertInChunks(db.collection('healthmetrics'), healthMetrics);
  await insertInChunks(db.collection('notifications'), notifications);
  await insertInChunks(db.collection('aiconversations'), conversations);

  return {
    cardinality: {
      doctors: doctors.length,
      sessions: sessions.length,
      messages: messages.length,
      healthmetrics: healthMetrics.length,
      notifications: notifications.length,
      aiconversations: conversations.length,
    },
    queryCases: [
      {
        id: 'Q-PRC-001',
        collection: 'doctors',
        filter: { verificationStatus: 'approved' },
        sort: { userId: 1 },
        index: 'verificationStatus_1_userId_1',
      },
      {
        id: 'Q-CON-001',
        collection: 'sessions',
        filter: { patientId: patientIds[0], status: 'pending' },
        sort: { scheduledAt: -1, _id: -1 },
        index: 'patientId_1_status_1_scheduledAt_-1__id_-1',
      },
      {
        id: 'Q-CON-002',
        collection: 'sessions',
        filter: { doctorId: doctorIds[0] },
        sort: { scheduledAt: -1, _id: -1 },
        index: 'doctorId_1_scheduledAt_-1__id_-1',
      },
      {
        id: 'Q-MSG-001',
        collection: 'messages',
        filter: { doctorSessionId: sessionIds[0] },
        sort: { sentAt: -1, _id: -1 },
        index: 'doctorSessionId_1_sentAt_-1__id_-1',
      },
      {
        id: 'Q-HLT-001',
        collection: 'healthmetrics',
        filter: { patientId: patientIds[0], type: 'heart_rate' },
        sort: { recordedAt: -1, _id: -1 },
        index: 'patientId_1_type_1_recordedAt_-1__id_-1',
      },
      {
        id: 'Q-NOT-001',
        collection: 'notifications',
        filter: { userId: patientIds[0], isRead: false },
        sort: { createdAt: -1, _id: -1 },
        index: 'userId_1_isRead_1_createdAt_-1__id_-1',
      },
      {
        id: 'Q-AIC-001',
        collection: 'aiconversations',
        filter: { userId: patientIds[0] },
        sort: { createdAt: -1, _id: -1 },
        index: 'userId_1_createdAt_-1__id_-1',
      },
      {
        id: 'Q-AIC-002',
        collection: 'aiconversations',
        filter: { userId: patientIds[1], isArchived: false },
        sort: { createdAt: -1, _id: -1 },
        index: 'userId_1_isArchived_1_createdAt_-1__id_-1',
      },
    ],
  };
}

async function createLegacyIndexes(db: Db): Promise<void> {
  await db.collection('sessions').createIndexes([
    { key: { patientId: 1, scheduledAt: -1 }, name: 'legacy_patient_time' },
    { key: { doctorId: 1, scheduledAt: -1 }, name: 'legacy_doctor_time' },
  ]);
  await db
    .collection('messages')
    .createIndex(
      { doctorSessionId: 1, sentAt: -1 },
      { name: 'legacy_session_time' },
    );
  await db
    .collection('healthmetrics')
    .createIndex(
      { patientId: 1, type: 1, recordedAt: -1 },
      { name: 'legacy_patient_type_time' },
    );
  await db
    .collection('notifications')
    .createIndex({ userId: 1, isRead: 1 }, { name: 'legacy_user_unread' });
  await db
    .collection('aiconversations')
    .createIndex({ userId: 1, createdAt: -1 }, { name: 'legacy_user_time' });
}

async function explainCases(
  db: Db,
  queryCases: QueryCase[],
  verifyManagedIndex: boolean,
): Promise<Record<string, ExplainSummary>> {
  const result: Record<string, ExplainSummary> = {};
  for (const queryCase of queryCases) {
    const cursor = db
      .collection(queryCase.collection)
      .find(queryCase.filter)
      .sort(queryCase.sort)
      .limit(PAGE_LIMIT);
    const summary = summarizeExplain(await cursor.explain('executionStats'));
    summary.latencyP95Millis = await measureP95(db, queryCase);
    if (verifyManagedIndex && !summary.indexNames.includes(queryCase.index)) {
      throw new Error(
        `${queryCase.id} did not select expected index ${queryCase.index}`,
      );
    }
    result[queryCase.id] = summary;
  }
  return result;
}

async function main(): Promise<void> {
  const uri = process.env.RF2D_MONGODB_URI ?? DEFAULT_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const temporaryDatabaseName = `healthcare_rf2d_perf_${new ObjectId().toHexString()}`;
  const db = client.db(temporaryDatabaseName);

  try {
    const fixture = await seedRepresentativeData(db);
    await createLegacyIndexes(db);
    const before = await explainCases(db, fixture.queryCases, false);
    await applyRf2dQueryIndexes(db);
    const after = await explainCases(db, fixture.queryCases, true);

    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          database: temporaryDatabaseName,
          pageLimit: PAGE_LIMIT,
          cardinality: fixture.cardinality,
          before,
          after,
        },
        null,
        2,
      ),
    );
  } finally {
    await db.dropDatabase();
    await client.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
