import type { Db, Document } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const CC012_BILLING_ACCESS_VERSION = 202610151000;
export const CC012_BILLING_ACCESS_NAME = 'cc012-billing-access';
export const CC012_BILLING_ACCESS_CHECKSUM = migrationChecksum({
  version: CC012_BILLING_ACCESS_VERSION,
  name: CC012_BILLING_ACCESS_NAME,
  steps: [
    'create-plans-and-subscriptions',
    'create-billing-access-indexes',
    'add-care-program-access-slots',
  ],
});

export const CC012_PLAN_COLLECTION = {
  name: 'plans',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'code',
        'version',
        'name',
        'price',
        'currency',
        'durationDays',
        'aiRequestLimit',
        'aiTokenLimit',
        'aiQuotaPeriod',
        'consultationLimitPerCycle',
        'activeCareProgramLimit',
        'benefits',
        'refundPolicy',
        'status',
        'createdBy',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        code: { bsonType: 'string' },
        version: { bsonType: ['int', 'long', 'double'] },
        name: { bsonType: 'string' },
        description: { bsonType: 'string' },
        price: { bsonType: ['int', 'long', 'double'] },
        currency: { bsonType: 'string' },
        durationDays: { bsonType: ['int', 'long', 'double'] },
        aiRequestLimit: { bsonType: ['int', 'long', 'double'] },
        aiTokenLimit: { bsonType: ['int', 'long', 'double'] },
        aiQuotaPeriod: { enum: ['day', 'subscription_cycle'] },
        consultationLimitPerCycle: { bsonType: ['int', 'long', 'double'] },
        activeCareProgramLimit: { bsonType: ['int', 'long', 'double'] },
        benefits: { bsonType: 'object' },
        refundPolicy: { bsonType: 'object' },
        status: { enum: ['draft', 'published', 'retired'] },
        effectiveFrom: { bsonType: 'date' },
        effectiveUntil: { bsonType: 'date' },
        createdBy: { bsonType: 'objectId' },
        publishedBy: { bsonType: 'objectId' },
        publishedAt: { bsonType: 'date' },
        retiredBy: { bsonType: 'objectId' },
        retiredAt: { bsonType: 'date' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  } satisfies Document,
} as const;

export const CC012_SUBSCRIPTION_COLLECTION = {
  name: 'subscriptions',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'userId',
        'planId',
        'status',
        'source',
        'planSnapshot',
        'cycleNumber',
        'currentPeriodStart',
        'currentPeriodEnd',
        'startedAt',
        'expiresAt',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        userId: { bsonType: 'objectId' },
        planId: { bsonType: 'objectId' },
        sourceOrderId: { bsonType: 'objectId' },
        status: { enum: ['active', 'expired', 'cancelled'] },
        source: { enum: ['payment', 'free_grant', 'admin_demo'] },
        planSnapshot: { bsonType: 'object' },
        nextPlanId: { bsonType: 'objectId' },
        nextPlanSnapshot: { bsonType: 'object' },
        nextPlanOrderId: { bsonType: 'objectId' },
        nextPlanStartsAt: { bsonType: 'date' },
        cycleNumber: { bsonType: ['int', 'long', 'double'] },
        currentPeriodStart: { bsonType: 'date' },
        currentPeriodEnd: { bsonType: 'date' },
        startedAt: { bsonType: 'date' },
        expiresAt: { bsonType: 'date' },
        cancelledAt: { bsonType: 'date' },
        cancelledBy: { bsonType: 'objectId' },
        cancellationReason: { bsonType: 'string' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  } satisfies Document,
} as const;

export const CC012_BILLING_COLLECTIONS = [
  CC012_PLAN_COLLECTION,
  CC012_SUBSCRIPTION_COLLECTION,
] as const;

export const CC012_BILLING_INDEXES = [
  {
    collection: 'plans',
    name: 'code_1_version_1',
    key: { code: 1, version: 1 },
    unique: true,
  },
  {
    collection: 'plans',
    name: 'code_1_status_published_unique',
    key: { code: 1, status: 1 },
    unique: true,
    partialFilterExpression: { status: 'published' },
  },
  {
    collection: 'plans',
    name: 'code_1_status_1_effectiveFrom_1',
    key: { code: 1, status: 1, effectiveFrom: 1 },
  },
  {
    collection: 'subscriptions',
    name: 'sourceOrderId_1',
    key: { sourceOrderId: 1 },
    unique: true,
    sparse: true,
  },
  {
    collection: 'subscriptions',
    name: 'nextPlanOrderId_1',
    key: { nextPlanOrderId: 1 },
    unique: true,
    sparse: true,
  },
  {
    collection: 'subscriptions',
    name: 'userId_1_status_active_unique',
    key: { userId: 1, status: 1 },
    unique: true,
    partialFilterExpression: { status: 'active' },
  },
  {
    collection: 'subscriptions',
    name: 'userId_1_status_1_expiresAt_1',
    key: { userId: 1, status: 1, expiresAt: 1 },
  },
  {
    collection: 'subscriptions',
    name: 'status_1_nextPlanStartsAt_1',
    key: { status: 1, nextPlanStartsAt: 1 },
  },
  {
    collection: 'patientcareprograms',
    name: 'patientId_1_programAccessSlot_admitted_unique',
    key: { patientId: 1, programAccessSlot: 1 },
    unique: true,
    partialFilterExpression: {
      status: { $in: ['pending', 'active', 'paused'] },
      programAccessSlot: { $exists: true },
    },
  },
] as const;

async function ensureCollection(
  db: Db,
  collection: (typeof CC012_BILLING_COLLECTIONS)[number],
) {
  const exists = await db
    .listCollections({ name: collection.name }, { nameOnly: true })
    .hasNext();
  if (!exists)
    await db.createCollection(collection.name, {
      validator: collection.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  else
    await db.command({
      collMod: collection.name,
      validator: collection.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
}

export async function applyCc012BillingAccess(db: Db): Promise<void> {
  for (const collection of CC012_BILLING_COLLECTIONS)
    await ensureCollection(db, collection);
  for (const index of CC012_BILLING_INDEXES)
    await db.collection(index.collection).createIndex(index.key, {
      name: index.name,
      ...('unique' in index ? { unique: index.unique } : {}),
      ...('sparse' in index ? { sparse: index.sparse } : {}),
      ...('partialFilterExpression' in index
        ? { partialFilterExpression: index.partialFilterExpression }
        : {}),
    });
}
