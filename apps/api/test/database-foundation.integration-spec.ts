import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { migrateDatabase } from '../src/database/migrations/run-migrations';
import { DATABASE_MIGRATIONS } from '../src/database/migrations/migration-registry';
import { applyRf10bCanonicalCleanup } from '../src/database/migrations/202609202000-rf10b-canonical-cleanup';
import { applyRf10cPhysicalCleanup } from '../src/database/migrations/202609202100-rf10c-physical-cleanup';
import { reconcileRf10c } from '../src/database/migrations/rf10c-reconciliation';
import { seedDemoData } from '../src/database/seeds/demo.seed';
import {
  REFERENCE_BLACKLIST_KEYWORDS,
  seedReferenceData,
} from '../src/database/seeds/reference.seed';
import { verifyDatabase } from '../src/database/verify-database';

const baseUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://localhost:27018/healthcare_rf4_test?replicaSet=rs0&directConnection=true';
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

    expect(first.applied).toHaveLength(DATABASE_MIGRATIONS.length);
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

  it('backfills AI feedbacks to canonical conversations idempotently', async () => {
    const oldConversationId = new ObjectId();
    const canonicalConversationId = new ObjectId();
    const feedbackId = new ObjectId();
    await client.db().collection('aiconversations').insertOne({
      _id: canonicalConversationId,
      legacyAiSessionId: oldConversationId,
    });
    await client.db().collection('aifeedbacks').insertOne({
      _id: feedbackId,
      aiSessionId: oldConversationId,
      createdAt: new Date(),
    });

    await applyRf10bCanonicalCleanup(client.db());
    await applyRf10bCanonicalCleanup(client.db());

    await expect(
      client.db().collection('aifeedbacks').findOne({ _id: feedbackId }),
    ).resolves.toMatchObject({ aiConversationId: canonicalConversationId });
  });

  it('blocks unsafe RF-10C cleanup, then removes reconciled legacy data idempotently', async () => {
    const unmatchedSessionId = new ObjectId();
    await client
      .db()
      .collection('sessions')
      .insertOne({ _id: unmatchedSessionId });
    await expect(reconcileRf10c(client.db())).resolves.toMatchObject({
      ready: false,
      blockers: { sessionsWithoutConsultation: 1 },
    });
    await expect(applyRf10cPhysicalCleanup(client.db())).rejects.toThrow(
      'sessionsWithoutConsultation=1',
    );
    await client
      .db()
      .collection('sessions')
      .deleteOne({ _id: unmatchedSessionId });

    const consultationId = new ObjectId();
    const legacyAiSessionId = new ObjectId();
    const legacyAiMessageId = new ObjectId();
    const aiConversationId = new ObjectId();
    await client.db().collection('sessions').insertOne({ _id: consultationId });
    await client
      .db()
      .collection('consultations')
      .insertOne({ _id: consultationId });
    await client
      .db()
      .collection('aisessions')
      .insertOne({ _id: legacyAiSessionId });
    await client.db().collection('aimessages').insertOne({
      _id: legacyAiMessageId,
      aiSessionId: legacyAiSessionId,
    });
    await client.db().collection('aiconversations').insertOne({
      _id: aiConversationId,
      legacyAiSessionId,
    });
    await client
      .db()
      .collection('aiconversationmessages')
      .insertOne({
        conversationId: aiConversationId,
        legacySourceKey: `session:${legacyAiSessionId}:${legacyAiMessageId}`,
      });
    await client.db().collection('messages').insertOne({
      consultationId,
      doctorSessionId: consultationId,
    });
    await client.db().collection('reviews').insertOne({
      consultationId,
      doctorSessionId: consultationId,
    });
    await client.db().collection('aihealthinsights').insertOne({
      patientId: new ObjectId(),
    });
    await client
      .db()
      .collection('messages')
      .createIndex(
        { doctorSessionId: 1, sentAt: -1 },
        { name: 'legacy_message_link' },
      );
    await client
      .db()
      .collection('aiconversations')
      .createIndex(
        { legacyAiSessionId: 1 },
        { name: 'legacy_ai_session_link' },
      );

    await expect(reconcileRf10c(client.db())).resolves.toMatchObject({
      ready: true,
      legacyDocuments: {
        sessions: 1,
        aiSessions: 1,
        aiMessages: 1,
        aiHealthInsights: 1,
      },
    });

    await applyRf10cPhysicalCleanup(client.db());
    await applyRf10cPhysicalCleanup(client.db());

    const collectionNames = new Set(
      (await client.db().listCollections({}, { nameOnly: true }).toArray()).map(
        (collection) => collection.name,
      ),
    );
    for (const retired of [
      'sessions',
      'aisessions',
      'aimessages',
      'aihealthinsights',
    ]) {
      expect(collectionNames).not.toContain(retired);
    }
    await expect(
      client
        .db()
        .collection('messages')
        .countDocuments({ doctorSessionId: { $exists: true } }),
    ).resolves.toBe(0);
    const messageIndexes = await client
      .db()
      .collection('messages')
      .listIndexes()
      .toArray();
    expect(messageIndexes).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'legacy_message_link' }),
      ]),
    );
    await expect(
      client
        .db()
        .collection('aiconversations')
        .countDocuments({ legacyAiSessionId: { $exists: true } }),
    ).resolves.toBe(0);
    await expect(
      client
        .db()
        .collection('aiconversationmessages')
        .countDocuments({ legacySourceKey: { $exists: true } }),
    ).resolves.toBe(0);
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
