import type { Db, Document } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const CC007_CARE_SUMMARIES_VERSION = 202610091200;
export const CC007_CARE_SUMMARIES_NAME = 'cc007-care-summaries';
export const CC007_CARE_SUMMARIES_CHECKSUM = migrationChecksum({
  version: CC007_CARE_SUMMARIES_VERSION,
  name: CC007_CARE_SUMMARIES_NAME,
  steps: ['create-care-summaries', 'create-care-summary-indexes'],
});

export const CC007_CARE_SUMMARIES_COLLECTION = {
  name: 'caresummaries',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'reportId',
        'patientCareProgramId',
        'patientId',
        'careRuleId',
        'audience',
        'status',
        'summaryVersion',
        'uniqueKey',
        'promptVersion',
        'ruleVersion',
        'inputHash',
        'validation',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        reportId: { bsonType: 'objectId' },
        patientCareProgramId: { bsonType: 'objectId' },
        patientId: { bsonType: 'objectId' },
        careRuleId: { bsonType: 'objectId' },
        audience: { enum: ['patient', 'doctor'] },
        status: { enum: ['generated', 'fallback', 'failed'] },
        summaryVersion: { bsonType: ['int', 'long', 'double'] },
        uniqueKey: { bsonType: 'string' },
        content: { bsonType: 'object' },
        citations: { bsonType: 'array' },
        provider: { bsonType: 'string' },
        model: { bsonType: 'string' },
        promptVersion: { bsonType: 'string' },
        ruleVersion: { bsonType: ['int', 'long', 'double'] },
        inputHash: { bsonType: 'string' },
        validation: { bsonType: 'object' },
        latencyMs: { bsonType: ['int', 'long', 'double'] },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  } satisfies Document,
} as const;

export const CC007_CARE_SUMMARIES_INDEXES = [
  {
    collection: 'caresummaries',
    name: 'uniqueKey_1',
    key: { uniqueKey: 1 },
    unique: true,
  },
  {
    collection: 'caresummaries',
    name: 'reportId_1_audience_1_summaryVersion_1',
    key: { reportId: 1, audience: 1, summaryVersion: 1 },
    unique: true,
  },
  {
    collection: 'caresummaries',
    name: 'patientCareProgramId_1_createdAt_-1',
    key: { patientCareProgramId: 1, createdAt: -1 },
  },
  {
    collection: 'caresummaries',
    name: 'status_1_createdAt_-1',
    key: { status: 1, createdAt: -1 },
  },
] as const;

export async function applyCc007CareSummaries(db: Db): Promise<void> {
  const exists = await db
    .listCollections(
      { name: CC007_CARE_SUMMARIES_COLLECTION.name },
      { nameOnly: true },
    )
    .hasNext();
  if (!exists)
    await db.createCollection(CC007_CARE_SUMMARIES_COLLECTION.name, {
      validator: CC007_CARE_SUMMARIES_COLLECTION.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  else
    await db.command({
      collMod: CC007_CARE_SUMMARIES_COLLECTION.name,
      validator: CC007_CARE_SUMMARIES_COLLECTION.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  for (const index of CC007_CARE_SUMMARIES_INDEXES)
    await db
      .collection(index.collection)
      .createIndex(index.key, {
        name: index.name,
        ...('unique' in index ? { unique: index.unique } : {}),
      });
}
