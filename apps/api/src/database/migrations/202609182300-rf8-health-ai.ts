import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const RF8_HEALTH_AI_VERSION = 202609182300;
export const RF8_HEALTH_AI_NAME = 'rf8-health-ai';
export const RF8_HEALTH_AI_CHECKSUM = migrationChecksum({
  version: RF8_HEALTH_AI_VERSION,
  name: RF8_HEALTH_AI_NAME,
  steps: ['normalize-health-metric-metadata', 'create-canonical-ai-query-indexes'],
});

export async function applyRf8HealthAi(db: Db): Promise<void> {
  await db.collection('healthmetrics').updateMany(
    { source: { $exists: false } },
    { $set: { source: 'manual' } },
  );
  await db.collection('healthmetrics').updateMany(
    { timezone: { $exists: false } },
    { $set: { timezone: 'UTC' } },
  );
  await db.collection('healthmetrics').createIndex(
    { patientId: 1, type: 1, recordedAt: -1, _id: -1 },
    { name: 'patientId_1_type_1_recordedAt_-1__id_-1' },
  );
  await db.collection('aiconversations').createIndex(
    { userId: 1, lastMessageAt: -1, _id: -1 },
    { name: 'userId_1_lastMessageAt_-1__id_-1' },
  );
  await db.collection('aiconversations').createIndex(
    { userId: 1, status: 1, lastMessageAt: -1, _id: -1 },
    { name: 'userId_1_status_1_lastMessageAt_-1__id_-1' },
  );
}
