import type { Db } from 'mongodb';

export const RF2D_QUERY_INDEX_MIGRATION_ID = '202609162200-rf2d-query-indexes';

export type ManagedQueryIndex = {
  collection: string;
  name: string;
  key: Record<string, 1 | -1>;
};

export const RF2D_QUERY_INDEXES: readonly ManagedQueryIndex[] = [
  {
    collection: 'doctors',
    name: 'verificationStatus_1_userId_1',
    key: { verificationStatus: 1, userId: 1 },
  },
  {
    collection: 'sessions',
    name: 'patientId_1_scheduledAt_-1__id_-1',
    key: { patientId: 1, scheduledAt: -1, _id: -1 },
  },
  {
    collection: 'sessions',
    name: 'patientId_1_status_1_scheduledAt_-1__id_-1',
    key: { patientId: 1, status: 1, scheduledAt: -1, _id: -1 },
  },
  {
    collection: 'sessions',
    name: 'doctorId_1_scheduledAt_-1__id_-1',
    key: { doctorId: 1, scheduledAt: -1, _id: -1 },
  },
  {
    collection: 'sessions',
    name: 'doctorId_1_status_1_scheduledAt_-1__id_-1',
    key: { doctorId: 1, status: 1, scheduledAt: -1, _id: -1 },
  },
  {
    collection: 'messages',
    name: 'doctorSessionId_1_sentAt_-1__id_-1',
    key: { doctorSessionId: 1, sentAt: -1, _id: -1 },
  },
  {
    collection: 'healthmetrics',
    name: 'patientId_1_recordedAt_-1__id_-1',
    key: { patientId: 1, recordedAt: -1, _id: -1 },
  },
  {
    collection: 'healthmetrics',
    name: 'patientId_1_type_1_recordedAt_-1__id_-1',
    key: { patientId: 1, type: 1, recordedAt: -1, _id: -1 },
  },
  {
    collection: 'notifications',
    name: 'userId_1_createdAt_-1__id_-1',
    key: { userId: 1, createdAt: -1, _id: -1 },
  },
  {
    collection: 'notifications',
    name: 'userId_1_isRead_1_createdAt_-1__id_-1',
    key: { userId: 1, isRead: 1, createdAt: -1, _id: -1 },
  },
  {
    collection: 'aiconversations',
    name: 'userId_1_createdAt_-1__id_-1',
    key: { userId: 1, createdAt: -1, _id: -1 },
  },
  {
    collection: 'aiconversations',
    name: 'userId_1_type_1_createdAt_-1__id_-1',
    key: { userId: 1, type: 1, createdAt: -1, _id: -1 },
  },
  {
    collection: 'aiconversations',
    name: 'userId_1_status_1_createdAt_-1__id_-1',
    key: { userId: 1, status: 1, createdAt: -1, _id: -1 },
  },
  {
    collection: 'aiconversations',
    name: 'userId_1_isArchived_1_createdAt_-1__id_-1',
    key: { userId: 1, isArchived: 1, createdAt: -1, _id: -1 },
  },
] as const;

export async function applyRf2dQueryIndexes(db: Db): Promise<void> {
  for (const index of RF2D_QUERY_INDEXES) {
    await db
      .collection(index.collection)
      .createIndex(index.key, { name: index.name });
  }
}
