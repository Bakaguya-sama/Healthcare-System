import type { Db, Document, IndexDescription } from 'mongodb';
import { migrationChecksum } from './migration.types';
import { CC002_CARE_TASK_COLLECTION } from './202609301000-cc002-care-tasks';
import { CONSULTATION_QUEUE_COLLECTION } from './202611041000-consultation-queue';

export const CARE_TASK_POLICY_V1_VERSION = 202611052000;
export const CARE_TASK_POLICY_V1_NAME = 'care-task-policy-v1';

export const CARE_TASK_POLICY_V1_CARE_TASK_COLLECTION = {
  ...CC002_CARE_TASK_COLLECTION,
  validator: {
    $jsonSchema: {
      ...CC002_CARE_TASK_COLLECTION.validator.$jsonSchema,
      properties: {
        ...CC002_CARE_TASK_COLLECTION.validator.$jsonSchema.properties,
        contentRef: { bsonType: 'object' },
      },
    },
  },
} as const;

export const CARE_TASK_POLICY_V1_CONSULTATION_COLLECTION = {
  ...CONSULTATION_QUEUE_COLLECTION,
  validator: {
    $jsonSchema: {
      ...CONSULTATION_QUEUE_COLLECTION.validator.$jsonSchema,
      properties: {
        ...CONSULTATION_QUEUE_COLLECTION.validator.$jsonSchema.properties,
        careTaskId: { bsonType: 'objectId' },
      },
    },
  },
} as const;

export const CARE_TASK_POLICY_V1_HEALTH_EVALUATION_COLLECTION = {
  name: 'healthevaluations',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'patientCareProgramId',
        'patientId',
        'sourceType',
        'careRuleId',
        'severity',
        'reasonCodes',
        'inputData',
        'timeRange',
        'uniqueKey',
        'evaluatedAt',
        'createdAt',
      ],
      properties: {
        patientCareProgramId: { bsonType: 'objectId' },
        patientId: { bsonType: 'objectId' },
        careTaskId: { bsonType: 'objectId' },
        sourceType: { enum: ['health_metric', 'care_task_check_in'] },
        healthMetricId: { bsonType: 'objectId' },
        careRuleId: { bsonType: 'objectId' },
        severity: { enum: ['normal', 'attention', 'urgent'] },
        reasonCodes: { bsonType: 'array' },
        inputData: { bsonType: 'object' },
        timeRange: { bsonType: 'object' },
        uniqueKey: { bsonType: 'string' },
        evaluatedAt: { bsonType: 'date' },
        replacesEvaluationId: { bsonType: 'objectId' },
        createdAt: { bsonType: 'date' },
      },
      oneOf: [
        {
          required: ['healthMetricId'],
          properties: { sourceType: { enum: ['health_metric'] } },
        },
        {
          required: ['careTaskId'],
          properties: { sourceType: { enum: ['care_task_check_in'] } },
        },
      ],
    },
  },
} as const;

export const CARE_TASK_POLICY_V1_CONTENT_COLLECTION = {
  name: 'carecontents',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'contentId',
        'version',
        'locale',
        'displayType',
        'status',
        'title',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        contentId: { bsonType: 'string', maxLength: 64 },
        version: { bsonType: 'string', maxLength: 64 },
        locale: { bsonType: 'string', maxLength: 35 },
        displayType: { enum: ['article', 'video', 'document'] },
        status: { enum: ['draft', 'published', 'retired'] },
        title: { bsonType: 'string', maxLength: 200 },
        summary: { bsonType: 'string', maxLength: 1000 },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  },
} as const;

export const CARE_TASK_POLICY_V1_INDEXES: ReadonlyArray<
  IndexDescription & { collection: string; name: string }
> = [
  {
    collection: 'consultations',
    name: 'careTaskId_1_unique',
    key: { careTaskId: 1 },
    unique: true,
    sparse: true,
  },
  {
    collection: 'carecontents',
    name: 'content_ref_unique',
    key: { contentId: 1, version: 1, locale: 1, displayType: 1 },
    unique: true,
  },
  {
    collection: 'carecontents',
    name: 'status_1_contentId_1_version_1',
    key: { status: 1, contentId: 1, version: 1 },
  },
] as const;

export const CARE_TASK_POLICY_V1_CHECKSUM = migrationChecksum({
  version: CARE_TASK_POLICY_V1_VERSION,
  name: CARE_TASK_POLICY_V1_NAME,
  careTaskValidator: CARE_TASK_POLICY_V1_CARE_TASK_COLLECTION.validator,
  consultationValidator: CARE_TASK_POLICY_V1_CONSULTATION_COLLECTION.validator,
  evaluationValidator: CARE_TASK_POLICY_V1_HEALTH_EVALUATION_COLLECTION.validator,
  contentValidator: CARE_TASK_POLICY_V1_CONTENT_COLLECTION.validator,
  indexes: CARE_TASK_POLICY_V1_INDEXES,
});

export async function applyCareTaskPolicyV1(db: Db): Promise<void> {
  await db
    .collection('healthevaluations')
    .updateMany(
      { sourceType: { $exists: false } },
      { $set: { sourceType: 'health_metric' } },
    );
  for (const collection of [
    CARE_TASK_POLICY_V1_CARE_TASK_COLLECTION,
    CARE_TASK_POLICY_V1_CONSULTATION_COLLECTION,
    CARE_TASK_POLICY_V1_HEALTH_EVALUATION_COLLECTION,
  ])
    await db.command({
      collMod: collection.name,
      validator: collection.validator as Document,
      validationLevel: 'strict',
      validationAction: 'error',
    });

  const contentExists = await db
    .listCollections(
      { name: CARE_TASK_POLICY_V1_CONTENT_COLLECTION.name },
      { nameOnly: true },
    )
    .hasNext();
  if (!contentExists)
    await db.createCollection(CARE_TASK_POLICY_V1_CONTENT_COLLECTION.name, {
      validator: CARE_TASK_POLICY_V1_CONTENT_COLLECTION.validator as Document,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  else
    await db.command({
      collMod: CARE_TASK_POLICY_V1_CONTENT_COLLECTION.name,
      validator: CARE_TASK_POLICY_V1_CONTENT_COLLECTION.validator as Document,
      validationLevel: 'strict',
      validationAction: 'error',
    });

  for (const { collection, key, name, ...options } of CARE_TASK_POLICY_V1_INDEXES)
    await db.collection(collection).createIndex(key, { name, ...options });
}
