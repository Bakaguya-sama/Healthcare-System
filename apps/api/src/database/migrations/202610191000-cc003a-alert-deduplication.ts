import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const CC003A_ALERT_DEDUP_VERSION = 202610191000;
export const CC003A_ALERT_DEDUP_NAME = 'cc003a-alert-deduplication';
export const CC003A_ALERT_DEDUP_CHECKSUM = migrationChecksum({
  version: CC003A_ALERT_DEDUP_VERSION,
  name: CC003A_ALERT_DEDUP_NAME,
  steps: [
    'add-active-alert-key-index',
    'add-evaluation-audit-lookup-index',
    'preserve-legacy-alerts',
    'allow-active-deduplication-key',
  ],
});
export const CC003A_CARE_ALERT_COLLECTION = {
  name: 'carealerts',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'revision',
        'patientCareProgramId',
        'evaluationId',
        'patientId',
        'assignedDoctorId',
        'severity',
        'status',
        'reasonCodes',
        'uniqueKey',
        'detectedAt',
        'createdAt',
      ],
      properties: {
        revision: { bsonType: 'int' },
        patientCareProgramId: { bsonType: 'objectId' },
        evaluationId: { bsonType: 'objectId' },
        patientId: { bsonType: 'objectId' },
        assignedDoctorId: { bsonType: 'objectId' },
        severity: { enum: ['attention', 'urgent'] },
        status: { enum: ['open', 'acknowledged', 'resolved', 'dismissed'] },
        reasonCodes: { bsonType: 'array' },
        uniqueKey: { bsonType: 'string' },
        activeDeduplicationKey: { bsonType: 'string' },
        detectedAt: { bsonType: 'date' },
        createdAt: { bsonType: 'date' },
      },
    },
  },
} as const;
export const CC003A_ALERT_DEDUP_INDEXES = [
  {
    collection: 'carealerts',
    name: 'activeDeduplicationKey_1_unique',
    key: { activeDeduplicationKey: 1 },
    unique: true,
    sparse: true,
  },
  {
    collection: 'auditlogs',
    name: 'action_1_metadata.evaluationId_1',
    key: { action: 1, 'metadata.evaluationId': 1 },
  },
] as const;

export async function applyCc003aAlertDedup(db: Db) {
  await db.command({
    collMod: CC003A_CARE_ALERT_COLLECTION.name,
    validator: CC003A_CARE_ALERT_COLLECTION.validator,
    validationLevel: 'strict',
    validationAction: 'error',
  });
  for (const index of CC003A_ALERT_DEDUP_INDEXES) {
    await db.collection(index.collection).createIndex(index.key, {
      name: index.name,
      ...('unique' in index
        ? { unique: index.unique, sparse: index.sparse }
        : {}),
    });
  }
}
