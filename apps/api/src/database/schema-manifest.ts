import type { Db, Document } from 'mongodb';
import { RF2D_QUERY_INDEXES } from './migrations/202609162200-rf2d-query-indexes';
import {
  CC000_FOUNDATION_COLLECTIONS,
  CC000_FOUNDATION_INDEXES,
} from './migrations/202609281000-cc000-chronic-care-foundation';
import {
  CC001A_COLLECTIONS,
  CC001A_INDEXES,
} from './migrations/202609291000-cc001a-care-catalog';
import {
  NOTIFICATION_CAMPAIGN_RECIPIENT_INDEXES,
  NOTIFICATION_CAMPAIGN_RECIPIENT_VALIDATOR,
  RETIRED_AI_CONVERSATION_INDEX_NAMES,
} from './migrations/202609291200-schema-simplification';
import { CC001B_CARE_COMMAND_IDEMPOTENCY_VALIDATOR } from './migrations/202609291100-cc001b-enrollment';
import { CC014_BASELINE_SCHEMA_COLLECTIONS } from './migrations/202609291300-cc014-baseline-schema-engine';
import { CC014_PATIENT_CARE_PROGRAM_VALIDATOR } from './migrations/202609300900-cc014-remove-redundant-baseline-version';
import {
  CC002_CARE_TASK_COLLECTION,
  CC002_CARE_TASK_INDEXES,
} from './migrations/202609301000-cc002-care-tasks';
import { CC005_DOCTOR_PRIORITY_INBOX_INDEX } from './migrations/202610061000-cc005-doctor-priority-inbox';
import {
  CC006_CARE_REPORT_COLLECTION,
  CC006_CARE_REPORT_INDEXES,
} from './migrations/202610061100-cc006-care-reports';
import {
  HEALTH_METRIC_COLLECTION,
  HEALTH_METRIC_INDEXES,
} from './migrations/202610061200-health-metric-contract-alignment';
import {
  CC007_CARE_SUMMARIES_COLLECTION,
  CC007_CARE_SUMMARIES_INDEXES,
} from './migrations/202610091200-cc007-care-summaries';
import {
  CC012_BILLING_COLLECTIONS,
  CC012_BILLING_INDEXES,
} from './migrations/202610151000-cc012-billing-access';
import { DATA001A_CONSULTATION_INDEXES } from './migrations/202610152000-data001a-consultation-contract';
import { CC013B_CONSULTATION_COLLECTION } from './migrations/202610201100-cc013b-stale-consultation-recovery';
import { CC012B_AI_QUOTA_COLLECTIONS, CC012B_AI_QUOTA_INDEXES } from './migrations/202610211000-cc012b-ai-quota';
import { CC012B_AI_QUOTA_SETTLEMENT_COLLECTIONS } from './migrations/202610221000-cc012b-ai-quota-settlement';
import { CC008_CARE_ALERT_CONSULTATION_INDEX } from './migrations/202610161000-cc008-care-alert-consultation-link';
import {
  CC003A_ALERT_DEDUP_INDEXES,
  CC003A_CARE_ALERT_COLLECTION,
} from './migrations/202610191000-cc003a-alert-deduplication';
import {
  CC013_CONSULTATION_USAGE_COLLECTION,
  CC013_CONSULTATION_USAGE_INDEXES,
} from './migrations/202610161100-cc013-consultation-usage-ledger';

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

export const EXPECTED_DATABASE_COLLECTIONS = [
  ...INFRASTRUCTURE_COLLECTIONS,
  ...CC000_FOUNDATION_COLLECTIONS.filter(
    (collection) =>
      collection.name !== 'careprograms' &&
      collection.name !== 'patientcareprograms',
  ),
  ...CC014_BASELINE_SCHEMA_COLLECTIONS.filter(
    (collection) => collection.name !== 'patientcareprograms',
  ),
  {
    name: 'patientcareprograms',
    validator: CC014_PATIENT_CARE_PROGRAM_VALIDATOR,
  },
  ...CC001A_COLLECTIONS.filter(
    (collection) => collection.name !== 'carecommandidempotencies',
  ),
  {
    name: 'carecommandidempotencies',
    validator: CC001B_CARE_COMMAND_IDEMPOTENCY_VALIDATOR,
  },
  {
    name: 'notificationcampaignrecipients',
    validator: NOTIFICATION_CAMPAIGN_RECIPIENT_VALIDATOR,
  },
  CC002_CARE_TASK_COLLECTION,
  CC003A_CARE_ALERT_COLLECTION,
  CC006_CARE_REPORT_COLLECTION,
  CC007_CARE_SUMMARIES_COLLECTION,
  HEALTH_METRIC_COLLECTION,
  CC013B_CONSULTATION_COLLECTION,
  ...CC012_BILLING_COLLECTIONS,
  CC013_CONSULTATION_USAGE_COLLECTION,
  ...CC012B_AI_QUOTA_SETTLEMENT_COLLECTIONS,
] as const;

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
  ...RF2D_QUERY_INDEXES.filter(
    (index) =>
      index.collection !== 'healthmetrics' &&
      !['sessions', 'messages'].includes(index.collection) &&
      !RETIRED_AI_CONVERSATION_INDEX_NAMES.includes(
        index.name as (typeof RETIRED_AI_CONVERSATION_INDEX_NAMES)[number],
      ),
  ),
  {
    collection: 'users',
    name: 'email_1',
    key: { email: 1 },
    unique: true,
    partialFilterExpression: { email: { $type: 'string' } },
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
    collection: 'consultations',
    name: 'stale_on_demand_recovery',
    key: { mode: 1, requestStatus: 1, sessionStatus: 1, respondedAt: 1, _id: 1 },
  },
  {
    collection: 'consultations',
    name: 'stale_scheduled_review',
    key: { mode: 1, requestStatus: 1, sessionStatus: 1, scheduledStartAt: 1, _id: 1 },
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
  ...HEALTH_METRIC_INDEXES,
  {
    collection: 'aiconversations',
    name: 'userId_1_lastMessageAt_-1__id_-1',
    key: { userId: 1, lastMessageAt: -1, _id: -1 },
  },
  ...NOTIFICATION_CAMPAIGN_RECIPIENT_INDEXES,
  {
    collection: 'aiconversations',
    name: 'userId_1_archivedAt_1_createdAt_-1__id_-1',
    key: { userId: 1, archivedAt: 1, createdAt: -1, _id: -1 },
  },
  {
    collection: 'aiconversationmessages',
    name: 'conversationId_1_timestamp_-1__id_-1',
    key: { conversationId: 1, timestamp: -1, _id: -1 },
  },
  {
    collection: 'aifeedbacks',
    name: 'aiConversationId_1_createdAt_-1',
    key: { aiConversationId: 1, createdAt: -1 },
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
  ...CC000_FOUNDATION_INDEXES,
  ...CC001A_INDEXES,
  ...CC002_CARE_TASK_INDEXES,
  CC005_DOCTOR_PRIORITY_INBOX_INDEX,
  ...CC006_CARE_REPORT_INDEXES,
  ...CC007_CARE_SUMMARIES_INDEXES,
  ...DATA001A_CONSULTATION_INDEXES,
  CC008_CARE_ALERT_CONSULTATION_INDEX,
  ...CC003A_ALERT_DEDUP_INDEXES,
  ...CC012_BILLING_INDEXES,
  ...CC013_CONSULTATION_USAGE_INDEXES,
  ...CC012B_AI_QUOTA_INDEXES,
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
