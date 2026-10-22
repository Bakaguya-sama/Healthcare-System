import type { Db, Document } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const CC012B_AI_QUOTA_VERSION = 202610211000;
export const CC012B_AI_QUOTA_NAME = 'cc012b-ai-quota';
export const CC012B_AI_QUOTA_CHECKSUM = migrationChecksum({ version: CC012B_AI_QUOTA_VERSION, name: CC012B_AI_QUOTA_NAME, steps: ['create-ai-usage-and-reservation-ledger'] });
const usageProperties = {
  userId: { bsonType: 'objectId' }, periodStart: { bsonType: 'date' }, periodType: { enum: ['day', 'subscription_cycle'] },
  chatRequestCount: { bsonType: ['int', 'long', 'double'] }, chatInputTokens: { bsonType: ['int', 'long', 'double'] }, chatOutputTokens: { bsonType: ['int', 'long', 'double'] }, chatTotalTokens: { bsonType: ['int', 'long', 'double'] }, reservedRequestCount: { bsonType: ['int', 'long', 'double'] }, reservedTokens: { bsonType: ['int', 'long', 'double'] }, createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
};
export const CC012B_AI_USAGE_COLLECTION = { name: 'aiusagedailies', validator: { $jsonSchema: { bsonType: 'object', required: ['userId', 'periodStart', 'periodType', 'chatRequestCount', 'chatInputTokens', 'chatOutputTokens', 'chatTotalTokens', 'reservedRequestCount', 'reservedTokens', 'createdAt', 'updatedAt'], properties: usageProperties } } } as const;
export const CC012B_AI_RESERVATION_COLLECTION = { name: 'aiquotareservations', validator: { $jsonSchema: { bsonType: 'object', required: ['userId', 'subscriptionId', 'periodType', 'periodStart', 'idempotencyKey', 'status', 'reservedTokens', 'estimatedInputTokens', 'maxOutputTokens', 'createdAt', 'updatedAt'], properties: { userId: { bsonType: 'objectId' }, subscriptionId: { bsonType: 'objectId' }, periodType: { enum: ['day', 'subscription_cycle'] }, periodStart: { bsonType: 'date' }, idempotencyKey: { bsonType: 'string' }, status: { enum: ['reserved', 'committed', 'released', 'usage_reconciliation_required'] }, reservedTokens: { bsonType: ['int', 'long', 'double'] }, estimatedInputTokens: { bsonType: ['int', 'long', 'double'] }, maxOutputTokens: { bsonType: ['int', 'long', 'double'] }, committedInputTokens: { bsonType: ['int', 'long', 'double'] }, committedOutputTokens: { bsonType: ['int', 'long', 'double'] }, releasedAt: { bsonType: 'date' }, usageReconciliationRequiredAt: { bsonType: 'date' }, settlementFailureReason: { bsonType: 'string' }, createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' } } } } } as const;
export const CC012B_AI_QUOTA_COLLECTIONS = [CC012B_AI_USAGE_COLLECTION, CC012B_AI_RESERVATION_COLLECTION] as const;
export const CC012B_AI_QUOTA_INDEXES = [
  { collection: 'aiusagedailies', name: 'userId_1_periodType_1_periodStart_1_unique', key: { userId: 1, periodType: 1, periodStart: 1 }, unique: true },
  { collection: 'aiquotareservations', name: 'userId_1_idempotencyKey_1_unique', key: { userId: 1, idempotencyKey: 1 }, unique: true },
] as const;
export async function applyCc012bAiQuota(db: Db) {
  for (const collection of CC012B_AI_QUOTA_COLLECTIONS) {
    if (!(await db.listCollections({ name: collection.name }, { nameOnly: true }).hasNext())) await db.createCollection(collection.name, { validator: collection.validator, validationLevel: 'strict', validationAction: 'error' });
    else await db.command({ collMod: collection.name, validator: collection.validator, validationLevel: 'strict', validationAction: 'error' });
  }
  for (const index of CC012B_AI_QUOTA_INDEXES) await db.collection(index.collection).createIndex(index.key, { name: index.name, unique: true });
}
