import type { Collection, Db, Document } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const SCHEMA_SIMPLIFICATION_VERSION = 202609291200;
export const SCHEMA_SIMPLIFICATION_NAME = 'schema-simplification';
export const SCHEMA_SIMPLIFICATION_CHECKSUM = migrationChecksum({
  version: SCHEMA_SIMPLIFICATION_VERSION,
  name: SCHEMA_SIMPLIFICATION_NAME,
  steps: [
    'make-user-email-partial-unique',
    'move-consultation-heartbeat-out-of-mongodb',
    'replace-ai-conversation-state-with-archived-at',
    'rename-ai-document-approval-and-validity-fields',
    'remove-plan-tier',
    'simplify-family-reminder-delivery-fields',
    'derive-medical-facility-freshness',
    'materialize-notification-campaign-recipients',
    'flatten-violation-resolution',
  ],
});

export const NOTIFICATION_CAMPAIGN_RECIPIENT_VALIDATOR: Document = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'campaignId',
      'userId',
      'status',
      'uniqueKey',
      'selectedAt',
      'createdAt',
      'updatedAt',
    ],
    properties: {
      campaignId: { bsonType: 'objectId' },
      userId: { bsonType: 'objectId' },
      status: { enum: ['pending', 'materialized', 'failed', 'skipped'] },
      uniqueKey: { bsonType: 'string' },
      notificationId: { bsonType: 'objectId' },
      selectedAt: { bsonType: 'date' },
      processedAt: { bsonType: 'date' },
      failureCode: { bsonType: 'string' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
    },
  },
};

export const NOTIFICATION_CAMPAIGN_RECIPIENT_INDEXES = [
  {
    collection: 'notificationcampaignrecipients',
    name: 'campaignId_1_userId_1',
    key: { campaignId: 1, userId: 1 },
    unique: true,
  },
  {
    collection: 'notificationcampaignrecipients',
    name: 'uniqueKey_1',
    key: { uniqueKey: 1 },
    unique: true,
  },
  {
    collection: 'notificationcampaignrecipients',
    name: 'campaignId_1_status_1__id_1',
    key: { campaignId: 1, status: 1, _id: 1 },
  },
  {
    collection: 'notificationcampaignrecipients',
    name: 'userId_1_createdAt_-1',
    key: { userId: 1, createdAt: -1 },
  },
  {
    collection: 'notificationcampaignrecipients',
    name: 'notificationId_1',
    key: { notificationId: 1 },
    unique: true,
    sparse: true,
  },
] as const;

export const RETIRED_AI_CONVERSATION_INDEX_NAMES = [
  'userId_1_status_1_lastMessageAt_-1__id_-1',
  'userId_1_status_1_createdAt_-1__id_-1',
  'userId_1_isArchived_1_createdAt_-1__id_-1',
] as const;

async function collectionExists(db: Db, name: string): Promise<boolean> {
  return db.listCollections({ name }, { nameOnly: true }).hasNext();
}

async function ifExists(
  db: Db,
  name: string,
  operation: (collection: Collection<Document>) => Promise<void>,
) {
  if (await collectionExists(db, name)) {
    await operation(db.collection(name));
  }
}

async function dropIndexIfExists(
  collection: Collection<Document>,
  name: string,
) {
  if ((await collection.indexes()).some((index) => index.name === name)) {
    await collection.dropIndex(name);
  }
}

async function renameOptionalField(
  collection: Collection<Document>,
  oldName: string,
  newName: string,
) {
  await collection.updateMany(
    { [oldName]: { $exists: true }, [newName]: { $exists: false } },
    { $rename: { [oldName]: newName } },
  );
  await collection.updateMany(
    { [oldName]: { $exists: true } },
    { $unset: { [oldName]: '' } },
  );
}

async function flattenViolationResolutions(
  reports: Collection<Document>,
): Promise<void> {
  for await (const report of reports.find({ resolution: { $type: 'object' } })) {
    const resolution = report.resolution as Record<string, unknown>;
    await reports.updateOne(
      { _id: report._id },
      {
        $set: {
          ...(report.resolutionNote === undefined && resolution.note
            ? { resolutionNote: resolution.note }
            : {}),
          ...(report.actionTaken === undefined && resolution.action
            ? { actionTaken: resolution.action }
            : {}),
          ...(report.resolvedBy === undefined && resolution.handledBy
            ? { resolvedBy: resolution.handledBy }
            : {}),
          ...(report.resolvedAt === undefined && resolution.handledAt
            ? { resolvedAt: resolution.handledAt }
            : {}),
        },
      },
    );
  }
  await reports.updateMany(
    {},
    { $unset: { resolution: '', aiClassification: '' } },
  );
}

export async function applySchemaSimplification(db: Db): Promise<void> {
  await ifExists(db, 'users', async (users) => {
    await dropIndexIfExists(users, 'email_1');
    await users.createIndex(
      { email: 1 },
      {
        name: 'email_1',
        unique: true,
        partialFilterExpression: { email: { $type: 'string' } },
      },
    );
  });

  await ifExists(db, 'consultations', async (consultations) => {
    await consultations.updateMany(
      { expectedDurationMinutes: { $exists: false } },
      { $set: { expectedDurationMinutes: 30 } },
    );
    await consultations.updateMany(
      { lastHeartbeatAt: { $exists: true } },
      { $unset: { lastHeartbeatAt: '' } },
    );
  });

  await ifExists(db, 'aiconversations', async (conversations) => {
    for await (const conversation of conversations.find({
      archivedAt: { $exists: false },
      $or: [{ isArchived: true }, { status: 'archived' }],
    })) {
      await conversations.updateOne(
        { _id: conversation._id, archivedAt: { $exists: false } },
        {
          $set: {
            archivedAt:
              conversation.updatedAt ?? conversation.createdAt ?? new Date(),
          },
        },
      );
    }
    await conversations.updateMany(
      {},
      {
        $unset: {
          status: '',
          isArchived: '',
          completedAt: '',
          endedAt: '',
        },
      },
    );
    for (const indexName of RETIRED_AI_CONVERSATION_INDEX_NAMES) {
      await dropIndexIfExists(conversations, indexName);
    }
    await conversations.createIndex(
      { userId: 1, archivedAt: 1, createdAt: -1, _id: -1 },
      { name: 'userId_1_archivedAt_1_createdAt_-1__id_-1' },
    );
  });

  await ifExists(db, 'aidocuments', async (documents) => {
    await renameOptionalField(documents, 'effectiveUntil', 'validUntil');
    await renameOptionalField(documents, 'reviewedBy', 'approvedBy');
    await renameOptionalField(documents, 'reviewedAt', 'approvedAt');
    await dropIndexIfExists(documents, 'reviewStatus_1_effectiveUntil_1');
    await documents.createIndex(
      { reviewStatus: 1, validUntil: 1 },
      { name: 'reviewStatus_1_validUntil_1' },
    );
    await documents.updateMany(
      { reviewStatus: { $exists: false }, status: 'active' },
      { $set: { reviewStatus: 'approved' } },
    );
    await documents.updateMany(
      { reviewStatus: { $exists: false } },
      { $set: { reviewStatus: 'pending_review' } },
    );
    for await (const document of documents.find({ reviewStatus: 'approved' })) {
      const approvedBy = document.approvedBy ?? document.uploadedBy;
      const approvedAt =
        document.approvedAt ?? document.updatedAt ?? document.createdAt;
      await documents.updateOne(
        { _id: document._id },
        {
          $set: {
            ...(approvedBy ? { approvedBy } : {}),
            ...(approvedAt ? { approvedAt } : {}),
          },
        },
      );
      if (await collectionExists(db, 'aidocumentchunks')) {
        await db.collection('aidocumentchunks').updateMany(
          { documentId: document._id },
          {
            $set: {
              reviewStatus: 'approved',
              ...(document.validUntil
                ? { validUntil: document.validUntil }
                : {}),
            },
          },
        );
      }
    }
  });

  await ifExists(db, 'aidocumentchunks', async (chunks) => {
    await renameOptionalField(chunks, 'effectiveUntil', 'validUntil');
    await dropIndexIfExists(chunks, 'isActive_1_effectiveUntil_1');
    await chunks.createIndex(
      { isActive: 1, validUntil: 1 },
      { name: 'isActive_1_validUntil_1' },
    );
    await chunks.createIndex(
      { reviewStatus: 1, isActive: 1 },
      { name: 'reviewStatus_1_isActive_1' },
    );
  });

  await ifExists(db, 'plans', async (plans) => {
    await plans.updateMany({ tier: { $exists: true } }, { $unset: { tier: '' } });
    await dropIndexIfExists(plans, 'tier_1_status_1_effectiveFrom_1');
    await plans.createIndex(
      { code: 1, status: 1, effectiveFrom: 1 },
      { name: 'code_1_status_1_effectiveFrom_1' },
    );
  });

  await ifExists(db, 'familyreminders', async (reminders) => {
    await reminders.updateMany(
      { status: { $in: ['sent', 'delivered', 'failed'] } },
      { $set: { status: 'dispatched' } },
    );
    await reminders.updateMany(
      {},
      {
        $unset: {
          channel: '',
          providerMessageId: '',
          attemptCount: '',
          lastError: '',
          sentAt: '',
          deliveredAt: '',
        },
      },
    );
  });

  await ifExists(db, 'medicalfacilities', async (facilities) => {
    await facilities.updateMany(
      { status: 'stale' },
      { $set: { status: 'verified' } },
    );
  });

  const recipientCollection = 'notificationcampaignrecipients';
  if (!(await collectionExists(db, recipientCollection))) {
    await db.createCollection(recipientCollection, {
      validator: NOTIFICATION_CAMPAIGN_RECIPIENT_VALIDATOR,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  }
  const recipients = db.collection(recipientCollection);
  for (const index of NOTIFICATION_CAMPAIGN_RECIPIENT_INDEXES) {
    await recipients.createIndex(index.key, {
      name: index.name,
      ...('unique' in index ? { unique: index.unique } : {}),
      ...('sparse' in index ? { sparse: index.sparse } : {}),
    });
  }

  await ifExists(db, 'violationreports', async (reports) => {
    await flattenViolationResolutions(reports);
  });

  // The runtime module currently uses the legacy physical collection name.
  await ifExists(db, 'violations', async (reports) => {
    await flattenViolationResolutions(reports);
  });
}
