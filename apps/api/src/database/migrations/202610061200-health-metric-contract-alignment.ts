import type { Db, Document } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const HEALTH_METRIC_ALIGNMENT_VERSION = 202610061200;
export const HEALTH_METRIC_ALIGNMENT_NAME = 'health-metric-contract-alignment';
export const HEALTH_METRIC_ALIGNMENT_CHECKSUM = migrationChecksum({
  version: HEALTH_METRIC_ALIGNMENT_VERSION,
  name: HEALTH_METRIC_ALIGNMENT_NAME,
  steps: [
    'backfill-health-metric-target-shape',
    'apply-health-metric-validator',
    'replace-health-metric-indexes',
  ],
});

export const HEALTH_METRIC_COLLECTION = {
  name: 'healthmetrics',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'meta',
        'values',
        'source',
        'validationStatus',
        'validationReasonCodes',
        'recordedAt',
        'ingestedAt',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        meta: {
          bsonType: 'object',
          required: ['patientId', 'metricType', 'unit'],
          properties: {
            patientId: { bsonType: 'objectId' },
            metricType: {
              enum: [
                'blood_pressure',
                'heart_rate',
                'blood_glucose',
                'oxygen_saturation',
                'body_temperature',
                'respiratory_rate',
                'bmi',
                'weight',
                'height',
                'water_intake',
                'kcal_intake',
              ],
            },
            unit: { bsonType: 'string' },
          },
        },
        values: { bsonType: 'object' },
        source: { enum: ['manual', 'device', 'clinician', 'import'] },
        sourceRef: { bsonType: 'object' },
        validationStatus: {
          enum: ['valid', 'rejected', 'superseded', 'voided'],
        },
        validationReasonCodes: { bsonType: 'array' },
        recordedTimezone: { bsonType: 'string' },
        replacesMetricId: { bsonType: 'objectId' },
        recordedAt: { bsonType: 'date' },
        ingestedAt: { bsonType: 'date' },
        voidedAt: { bsonType: 'date' },
        voidedBy: { bsonType: 'objectId' },
        voidReason: { bsonType: 'string' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  } satisfies Document,
} as const;

export const HEALTH_METRIC_INDEXES = [
  {
    collection: 'healthmetrics',
    name: 'meta.patientId_1_recordedAt_-1__id_-1',
    key: { 'meta.patientId': 1, recordedAt: -1, _id: -1 },
  },
  {
    collection: 'healthmetrics',
    name: 'meta.patientId_1_meta.metricType_1_recordedAt_-1__id_-1',
    key: {
      'meta.patientId': 1,
      'meta.metricType': 1,
      recordedAt: -1,
      _id: -1,
    },
  },
  {
    collection: 'healthmetrics',
    name: 'replacesMetricId_1',
    key: { replacesMetricId: 1 },
    unique: true,
    sparse: true,
  },
] as const;

const LEGACY_INDEX_NAMES = [
  'patientId_1_recordedAt_-1__id_-1',
  'patientId_1_type_1_recordedAt_-1__id_-1',
] as const;

export async function applyHealthMetricContractAlignment(db: Db) {
  const exists = await db
    .listCollections(
      { name: HEALTH_METRIC_COLLECTION.name },
      { nameOnly: true },
    )
    .hasNext();
  if (!exists)
    await db.createCollection(HEALTH_METRIC_COLLECTION.name, {
      validator: HEALTH_METRIC_COLLECTION.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  else {
    await db
      .collection(HEALTH_METRIC_COLLECTION.name)
      .updateMany({ meta: { $exists: false } }, [
        {
          $set: {
            meta: {
              patientId: '$patientId',
              metricType: '$type',
              unit: '$unit',
            },
            values: {
              $arrayToObject: {
                $map: {
                  input: { $objectToArray: '$values' },
                  as: 'entry',
                  in: {
                    k: '$$entry.k',
                    v: { $ifNull: ['$$entry.v.value', '$$entry.v'] },
                  },
                },
              },
            },
            source: {
              $cond: [
                {
                  $in: ['$source', ['manual', 'device', 'clinician', 'import']],
                },
                '$source',
                'manual',
              ],
            },
            validationStatus: 'valid',
            validationReasonCodes: [],
            recordedTimezone: { $ifNull: ['$timezone', 'UTC'] },
            recordedAt: { $ifNull: ['$recordedAt', '$createdAt'] },
            ingestedAt: {
              $ifNull: ['$createdAt', { $ifNull: ['$recordedAt', '$$NOW'] }],
            },
            createdAt: {
              $ifNull: ['$createdAt', { $ifNull: ['$recordedAt', '$$NOW'] }],
            },
            updatedAt: {
              $ifNull: [
                '$updatedAt',
                {
                  $ifNull: [
                    '$createdAt',
                    { $ifNull: ['$recordedAt', '$$NOW'] },
                  ],
                },
              ],
            },
          },
        },
        { $unset: ['patientId', 'type', 'unit', 'timezone'] },
      ]);
    await db.command({
      collMod: HEALTH_METRIC_COLLECTION.name,
      validator: HEALTH_METRIC_COLLECTION.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  }

  const collection = db.collection(HEALTH_METRIC_COLLECTION.name);
  const listedIndexes = (await collection.listIndexes().toArray()) as Array<{
    name?: string;
  }>;
  const existingIndexes = new Set(
    listedIndexes.flatMap((index) => (index.name ? [index.name] : [])),
  );
  for (const name of LEGACY_INDEX_NAMES)
    if (existingIndexes.has(name)) await collection.dropIndex(name);
  for (const index of HEALTH_METRIC_INDEXES)
    await collection.createIndex(index.key, {
      name: index.name,
      ...('unique' in index ? { unique: index.unique } : {}),
      ...('sparse' in index ? { sparse: index.sparse } : {}),
    });
}
