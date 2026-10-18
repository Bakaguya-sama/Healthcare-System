import type { Db, Document } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const CC013_CONSULTATION_USAGE_LEDGER_VERSION = 202610161100;
export const CC013_CONSULTATION_USAGE_LEDGER_NAME =
  'cc013-consultation-usage-ledger';
export const CC013_CONSULTATION_USAGE_LEDGER_CHECKSUM = migrationChecksum({
  version: CC013_CONSULTATION_USAGE_LEDGER_VERSION,
  name: CC013_CONSULTATION_USAGE_LEDGER_NAME,
  steps: ['create-consultation-usage-ledger', 'backfill-subscription-counters'],
});

export const CC013_CONSULTATION_USAGE_COLLECTION = {
  name: 'consultationusages',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'userId', 'subscriptionId', 'consultationId', 'cycleStart', 'cycleEnd',
        'limitAtTime', 'status', 'source', 'uniqueRequestKey', 'reservedAt',
        'createdAt', 'updatedAt',
      ],
      properties: {
        userId: { bsonType: 'objectId' }, subscriptionId: { bsonType: 'objectId' },
        consultationId: { bsonType: 'objectId' }, cycleStart: { bsonType: 'date' },
        cycleEnd: { bsonType: 'date' }, limitAtTime: { bsonType: ['int', 'long', 'double'] },
        status: { enum: ['reserved', 'counted', 'released', 'expired'] },
        source: { enum: ['plan'] }, uniqueRequestKey: { bsonType: 'string' },
        reservedAt: { bsonType: 'date' }, countedAt: { bsonType: 'date' },
        releasedAt: { bsonType: 'date' }, releaseReason: { bsonType: 'string' },
        expiresAt: { bsonType: 'date' }, createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
      },
    },
  } satisfies Document,
} as const;

export const CC013_CONSULTATION_USAGE_INDEXES = [
  { collection: 'consultationusages', name: 'uniqueRequestKey_1', key: { uniqueRequestKey: 1 }, unique: true },
  { collection: 'consultationusages', name: 'consultationId_1', key: { consultationId: 1 }, unique: true },
  { collection: 'consultationusages', name: 'userId_1_cycleStart_1_cycleEnd_1_status_1', key: { userId: 1, cycleStart: 1, cycleEnd: 1, status: 1 } },
  { collection: 'consultationusages', name: 'subscriptionId_1_cycleStart_1_status_1', key: { subscriptionId: 1, cycleStart: 1, status: 1 } },
  { collection: 'consultationusages', name: 'status_1_expiresAt_1', key: { status: 1, expiresAt: 1 } },
] as const;

export async function applyCc013ConsultationUsageLedger(db: Db) {
  const exists = await db.listCollections({ name: CC013_CONSULTATION_USAGE_COLLECTION.name }, { nameOnly: true }).hasNext();
  if (!exists) await db.createCollection(CC013_CONSULTATION_USAGE_COLLECTION.name, { validator: CC013_CONSULTATION_USAGE_COLLECTION.validator, validationLevel: 'strict', validationAction: 'error' });
  else await db.command({ collMod: CC013_CONSULTATION_USAGE_COLLECTION.name, validator: CC013_CONSULTATION_USAGE_COLLECTION.validator, validationLevel: 'strict', validationAction: 'error' });
  await db.collection('subscriptions').updateMany(
    {},
    [
      { $set: {
        consultationUsageReserved: { $ifNull: ['$consultationUsageReserved', 0] },
        consultationUsageCounted: { $ifNull: ['$consultationUsageCounted', 0] },
      } },
    ],
  );
  for (const index of CC013_CONSULTATION_USAGE_INDEXES)
    await db.collection(index.collection).createIndex(index.key, {
      name: index.name,
      ...('unique' in index ? { unique: index.unique } : {}),
    });
}
