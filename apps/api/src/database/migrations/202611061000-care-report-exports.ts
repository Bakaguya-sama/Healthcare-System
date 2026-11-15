import type { Db, Document } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const CARE_REPORT_EXPORTS_VERSION = 202611061000;
export const CARE_REPORT_EXPORTS_NAME = 'care-report-exports';
export const CARE_REPORT_EXPORTS_CHECKSUM = migrationChecksum({
  version: CARE_REPORT_EXPORTS_VERSION,
  name: CARE_REPORT_EXPORTS_NAME,
  steps: [
    'create-care-report-exports',
    'create-export-worker-and-expiry-indexes',
  ],
});

export const CARE_REPORT_EXPORT_COLLECTION = {
  name: 'carereportexports',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'careReportId',
        'patientCareProgramId',
        'reportVersion',
        'inputHash',
        'ownerId',
        'audience',
        'format',
        'rendererVersion',
        'status',
        'idempotencyKey',
        'requestHash',
        'attemptCount',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        careReportId: { bsonType: 'objectId' },
        patientCareProgramId: { bsonType: 'objectId' },
        reportVersion: { bsonType: ['int', 'long', 'double'] },
        inputHash: { bsonType: 'string' },
        ownerId: { bsonType: 'objectId' },
        audience: { enum: ['patient', 'doctor'] },
        format: { enum: ['pdf', 'csv'] },
        rendererVersion: { enum: ['care-report-export.v1'] },
        status: {
          enum: ['pending', 'processing', 'ready', 'failed', 'expired'],
        },
        idempotencyKey: { bsonType: 'string' },
        requestHash: { bsonType: 'string' },
        storageKey: { bsonType: 'string' },
        mimeType: { bsonType: 'string' },
        byteSize: { bsonType: ['int', 'long', 'double'] },
        checksum: { bsonType: 'string' },
        expiresAt: { bsonType: 'date' },
        failureReasonCode: { bsonType: 'string' },
        attemptCount: { bsonType: ['int', 'long', 'double'] },
        leaseOwner: { bsonType: 'string' },
        leaseExpiresAt: { bsonType: 'date' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  } satisfies Document,
} as const;

export const CARE_REPORT_EXPORT_INDEXES = [
  {
    collection: 'carereportexports',
    name: 'ownerId_1_idempotencyKey_1',
    key: { ownerId: 1, idempotencyKey: 1 },
    unique: true,
  },
  {
    collection: 'carereportexports',
    name: 'status_1_leaseExpiresAt_1__id_1',
    key: { status: 1, leaseExpiresAt: 1, _id: 1 },
  },
  {
    collection: 'carereportexports',
    name: 'status_1_expiresAt_1__id_1',
    key: { status: 1, expiresAt: 1, _id: 1 },
  },
] as const;

export async function applyCareReportExports(db: Db): Promise<void> {
  const exists = await db
    .listCollections(
      { name: CARE_REPORT_EXPORT_COLLECTION.name },
      { nameOnly: true },
    )
    .hasNext();
  if (!exists)
    await db.createCollection(CARE_REPORT_EXPORT_COLLECTION.name, {
      validator: CARE_REPORT_EXPORT_COLLECTION.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  else
    await db.command({
      collMod: CARE_REPORT_EXPORT_COLLECTION.name,
      validator: CARE_REPORT_EXPORT_COLLECTION.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  for (const index of CARE_REPORT_EXPORT_INDEXES)
    await db.collection(index.collection).createIndex(index.key, {
      name: index.name,
      ...('unique' in index ? { unique: index.unique } : {}),
    });
}
