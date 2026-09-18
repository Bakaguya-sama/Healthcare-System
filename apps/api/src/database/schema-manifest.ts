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
  {
    collection: 'users',
    name: 'email_1',
    key: { email: 1 },
    unique: true,
  },
  {
    collection: 'users',
    name: 'role_1_accountStatus_1__id_1',
    key: { role: 1, accountStatus: 1, _id: 1 },
  },
  {
    collection: 'users',
    name: 'role_1_doctorProfile.verificationStatus_1__id_1',
    key: { role: 1, 'doctorProfile.verificationStatus': 1, _id: 1 },
  },
  {
    collection: 'users',
    name: 'doctorProfile.specialty_1_role_1_accountStatus_1__id_1',
    key: { 'doctorProfile.specialty': 1, role: 1, accountStatus: 1, _id: 1 },
  },
  {
    collection: 'auth_sessions',
    name: 'refreshTokenHash_1',
    key: { refreshTokenHash: 1 },
    unique: true,
  },
  {
    collection: 'auth_sessions',
    name: 'userId_1_revokedAt_1_expiresAt_1',
    key: { userId: 1, revokedAt: 1, expiresAt: 1 },
  },
  {
    collection: 'auth_sessions',
    name: 'expiresAt_1',
    key: { expiresAt: 1 },
    expireAfterSeconds: 0,
  },
  {
    collection: 'auth_events',
    name: 'userId_1_createdAt_-1__id_-1',
    key: { userId: 1, createdAt: -1, _id: -1 },
  },
  {
    collection: 'consultations',
    name: 'doctorId_1_requestStatus_1_requestedAt_-1__id_-1',
    key: { doctorId: 1, requestStatus: 1, requestedAt: -1, _id: -1 },
  },
  {
    collection: 'consultations',
    name: 'patientId_1_requestStatus_1_requestedAt_-1__id_-1',
    key: { patientId: 1, requestStatus: 1, requestedAt: -1, _id: -1 },
  },
  {
    collection: 'consultations',
    name: 'doctorId_1_sessionStatus_1_scheduledStartAt_1__id_1',
    key: { doctorId: 1, sessionStatus: 1, scheduledStartAt: 1, _id: 1 },
  },
  {
    collection: 'consultations',
    name: 'patientId_1_doctorId_1_requestStatus_1',
    key: { patientId: 1, doctorId: 1, requestStatus: 1 },
    unique: true,
  },
  {
    collection: 'consultations',
    name: 'roomId_1',
    key: { roomId: 1 },
    unique: true,
  },
  {
    collection: 'messages',
    name: 'consultationId_1_sentAt_-1__id_-1',
    key: { consultationId: 1, sentAt: -1, _id: -1 },
  },
  {
    collection: 'reviews',
    name: 'consultationId_unique',
    key: { consultationId: 1 },
    unique: true,
    sparse: true,
  },
  {
    collection: 'healthmetrics',
    name: 'patientId_1_type_1_recordedAt_-1__id_-1',
    key: { patientId: 1, type: 1, recordedAt: -1, _id: -1 },
  },
  {
    collection: 'aiconversations',
    name: 'userId_1_lastMessageAt_-1__id_-1',
    key: { userId: 1, lastMessageAt: -1, _id: -1 },
  },
  {
    collection: 'aiconversations',
    name: 'userId_1_status_1_lastMessageAt_-1__id_-1',
    key: { userId: 1, status: 1, lastMessageAt: -1, _id: -1 },
  },
  {
    collection: 'aiconversations',
    name: 'legacyAiSessionId_unique',
    key: { legacyAiSessionId: 1 },
    unique: true,
    sparse: true,
  },
  {
    collection: 'aiconversationmessages',
    name: 'conversationId_1_timestamp_-1__id_-1',
    key: { conversationId: 1, timestamp: -1, _id: -1 },
  },
  {
    collection: 'aiconversationmessages',
    name: 'legacySourceKey_unique',
    key: { legacySourceKey: 1 },
    unique: true,
    sparse: true,
  },
  {
    collection: 'outboxevents',
    name: 'idempotencyKey_unique',
    key: { idempotencyKey: 1 },
    unique: true,
  },
  {
    collection: 'outboxevents',
    name: 'status_1_nextAttemptAt_1_lockedAt_1__id_1',
    key: { status: 1, nextAttemptAt: 1, lockedAt: 1, _id: 1 },
  },
  {
    collection: 'outboxevents',
    name: 'status_1_lockExpiresAt_1__id_1',
    key: { status: 1, lockExpiresAt: 1, _id: 1 },
  },
  {
    collection: 'notifications',
    name: 'idempotencyKey_unique',
    key: { idempotencyKey: 1 },
    unique: true,
    sparse: true,
  },
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
