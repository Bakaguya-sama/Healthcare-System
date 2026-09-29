import type { Db, Document } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const CC000_CHRONIC_CARE_FOUNDATION_VERSION = 202609281000;
export const CC000_CHRONIC_CARE_FOUNDATION_NAME =
  'cc000-chronic-care-foundation';
export const CC000_CHRONIC_CARE_FOUNDATION_CHECKSUM = migrationChecksum({
  version: CC000_CHRONIC_CARE_FOUNDATION_VERSION,
  name: CC000_CHRONIC_CARE_FOUNDATION_NAME,
  steps: [
    'create-care-collections',
    'apply-care-validators',
    'create-care-indexes',
  ],
});

export const CC000_FOUNDATION_COLLECTIONS: ReadonlyArray<{
  name: string;
  validator: Document;
}> = [
  {
    name: 'careprograms',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: [
          'programCode',
          'version',
          'name',
          'diseaseKey',
          'status',
          'baselineForm',
          'taskTemplates',
          'reminderPolicy',
          'dataSources',
          'createdBy',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          programCode: { bsonType: 'string' },
          version: { bsonType: 'double', minimum: 1 },
          name: { bsonType: 'string' },
          diseaseKey: { bsonType: 'string' },
          description: { bsonType: 'string' },
          status: { enum: ['draft', 'published', 'retired'] },
          eligibilityForm: { bsonType: 'object' },
          baselineForm: { bsonType: 'object' },
          taskTemplates: { bsonType: 'array' },
          reminderPolicy: { bsonType: 'object' },
          reviewPolicy: { bsonType: 'object' },
          completionCriteria: { bsonType: 'object' },
          doctorEditableFields: { bsonType: 'array' },
          contentJourney: { bsonType: 'array' },
          dataSources: { bsonType: 'array' },
          createdBy: { bsonType: 'objectId' },
          publishedBy: { bsonType: 'objectId' },
          publishedAt: { bsonType: 'date' },
          retiredBy: { bsonType: 'objectId' },
          retiredAt: { bsonType: 'date' },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
  },
  {
    name: 'carerules',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: [
          'careProgramId',
          'version',
          'status',
          'rules',
          'createdBy',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          careProgramId: { bsonType: 'objectId' },
          version: { bsonType: 'double', minimum: 1 },
          status: { enum: ['draft', 'active', 'retired'] },
          rules: { bsonType: 'array' },
          dataSources: { bsonType: 'array' },
          testResults: { bsonType: 'object' },
          createdBy: { bsonType: 'objectId' },
          activatedBy: { bsonType: 'objectId' },
          activatedAt: { bsonType: 'date' },
          retiredBy: { bsonType: 'objectId' },
          retiredAt: { bsonType: 'date' },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
  },
  {
    name: 'patientcareprograms',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: [
          'patientId',
          'doctorId',
          'careProgramId',
          'careRuleId',
          'status',
          'timezone',
          'consent',
          'programConfig',
          'createdBy',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          patientId: { bsonType: 'objectId' },
          doctorId: { bsonType: 'objectId' },
          careProgramId: { bsonType: 'objectId' },
          careRuleId: { bsonType: 'objectId' },
          status: {
            enum: ['pending', 'active', 'paused', 'completed', 'cancelled'],
          },
          timezone: { bsonType: 'string' },
          consent: { bsonType: 'object' },
          baselineAnswers: { bsonType: 'object' },
          baselineCompletedAt: { bsonType: 'date' },
          customSettings: { bsonType: 'object' },
          programConfig: { bsonType: 'object' },
          startedAt: { bsonType: 'date' },
          expectedEndAt: { bsonType: 'date' },
          pausedAt: { bsonType: 'date' },
          pausedBy: { bsonType: 'objectId' },
          pauseReason: { bsonType: 'string' },
          resumedAt: { bsonType: 'date' },
          resumedBy: { bsonType: 'objectId' },
          completedAt: { bsonType: 'date' },
          completedBy: { bsonType: 'objectId' },
          completionReason: { bsonType: 'string' },
          cancelledAt: { bsonType: 'date' },
          cancelledBy: { bsonType: 'objectId' },
          cancellationReason: { bsonType: 'string' },
          createdBy: { bsonType: 'objectId' },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
  },
  {
    name: 'auditlogs',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['domain', 'entityType', 'action', 'createdAt'],
        properties: {
          domain: { bsonType: 'string' },
          entityType: { bsonType: 'string' },
          entityId: { bsonType: 'objectId' },
          action: { bsonType: 'string' },
          userId: { bsonType: 'objectId' },
          actorId: { bsonType: 'objectId' },
          fromStatus: { bsonType: 'string' },
          toStatus: { bsonType: 'string' },
          reason: { bsonType: 'string' },
          metadata: { bsonType: 'object' },
          ipAddress: { bsonType: 'string' },
          userAgent: { bsonType: 'string' },
          expiresAt: { bsonType: 'date' },
          createdAt: { bsonType: 'date' },
        },
      },
    },
  },
];

export const CC000_FOUNDATION_INDEXES = [
  {
    collection: 'careprograms',
    name: 'programCode_1_version_1',
    key: { programCode: 1, version: 1 },
    unique: true,
  },
  {
    collection: 'careprograms',
    name: 'status_1_diseaseKey_1_publishedAt_-1',
    key: { status: 1, diseaseKey: 1, publishedAt: -1 },
  },
  { collection: 'careprograms', name: 'createdBy_1', key: { createdBy: 1 } },
  {
    collection: 'carerules',
    name: 'careProgramId_1_version_1',
    key: { careProgramId: 1, version: 1 },
    unique: true,
  },
  {
    collection: 'carerules',
    name: 'careProgramId_1_status_1',
    key: { careProgramId: 1, status: 1 },
  },
  {
    collection: 'carerules',
    name: 'careProgramId_active_unique',
    key: { careProgramId: 1 },
    unique: true,
    partialFilterExpression: { status: 'active' },
  },
  {
    collection: 'patientcareprograms',
    name: 'patientId_1_status_1_createdAt_-1',
    key: { patientId: 1, status: 1, createdAt: -1 },
  },
  {
    collection: 'patientcareprograms',
    name: 'doctorId_1_status_1_updatedAt_-1',
    key: { doctorId: 1, status: 1, updatedAt: -1 },
  },
  {
    collection: 'patientcareprograms',
    name: 'careProgramId_1_status_1',
    key: { careProgramId: 1, status: 1 },
  },
  {
    collection: 'patientcareprograms',
    name: 'patientId_1_careProgramId_active_unique',
    key: { patientId: 1, careProgramId: 1 },
    unique: true,
    partialFilterExpression: {
      status: { $in: ['pending', 'active', 'paused'] },
    },
  },
  {
    collection: 'auditlogs',
    name: 'domain_1_entityType_1_entityId_1_createdAt_-1',
    key: { domain: 1, entityType: 1, entityId: 1, createdAt: -1 },
  },
  {
    collection: 'auditlogs',
    name: 'userId_1_createdAt_-1',
    key: { userId: 1, createdAt: -1 },
  },
  {
    collection: 'auditlogs',
    name: 'actorId_1_createdAt_-1',
    key: { actorId: 1, createdAt: -1 },
  },
  {
    collection: 'auditlogs',
    name: 'domain_1_action_1_createdAt_-1',
    key: { domain: 1, action: 1, createdAt: -1 },
  },
  {
    collection: 'auditlogs',
    name: 'expiresAt_1',
    key: { expiresAt: 1 },
    expireAfterSeconds: 0,
  },
] as const;

async function ensureCollection(
  db: Db,
  name: string,
  validator: Document,
): Promise<void> {
  const exists = await db
    .listCollections({ name }, { nameOnly: true })
    .hasNext();
  if (!exists) {
    await db.createCollection(name, {
      validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
    return;
  }
  await db.command({
    collMod: name,
    validator,
    validationLevel: 'strict',
    validationAction: 'error',
  });
}

export async function applyCc000ChronicCareFoundation(db: Db): Promise<void> {
  for (const collection of CC000_FOUNDATION_COLLECTIONS)
    await ensureCollection(db, collection.name, collection.validator);
  for (const index of CC000_FOUNDATION_INDEXES) {
    await db.collection(index.collection).createIndex(index.key, {
      name: index.name,
      ...('unique' in index ? { unique: index.unique } : {}),
      ...('partialFilterExpression' in index
        ? { partialFilterExpression: index.partialFilterExpression }
        : {}),
      ...('expireAfterSeconds' in index
        ? { expireAfterSeconds: index.expireAfterSeconds }
        : {}),
    });
  }
}
