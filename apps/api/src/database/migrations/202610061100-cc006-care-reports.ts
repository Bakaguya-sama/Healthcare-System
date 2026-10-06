import type { Db, Document } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const CC006_CARE_REPORTS_VERSION = 202610061100;
export const CC006_CARE_REPORTS_NAME = 'cc006-care-reports';
export const CC006_CARE_REPORTS_CHECKSUM = migrationChecksum({
  version: CC006_CARE_REPORTS_VERSION,
  name: CC006_CARE_REPORTS_NAME,
  steps: [
    'create-care-reports',
    'create-care-report-indexes',
    'create-consultation-care-report-index',
  ],
});

export const CC006_CARE_REPORT_COLLECTION = {
  name: 'carereports',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'patientCareProgramId',
        'patientId',
        'careRuleId',
        'reportType',
        'dataFormatVersion',
        'windowStart',
        'windowEnd',
        'timezone',
        'dataUntil',
        'status',
        'statistics',
        'trends',
        'missingData',
        'healthEvaluationSummary',
        'sourceData',
        'inputHash',
        'reportVersion',
        'generatedAt',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        patientCareProgramId: { bsonType: 'objectId' },
        patientId: { bsonType: 'objectId' },
        careRuleId: { bsonType: 'objectId' },
        reportType: { enum: ['weekly', 'thirty_day'] },
        dataFormatVersion: { enum: ['v1'] },
        windowStart: { bsonType: 'date' },
        windowEnd: { bsonType: 'date' },
        timezone: { bsonType: 'string' },
        dataUntil: { bsonType: 'date' },
        status: { enum: ['ready', 'superseded', 'invalidated'] },
        statistics: { bsonType: 'object' },
        trends: { bsonType: 'object' },
        missingData: { bsonType: 'array' },
        healthEvaluationSummary: { bsonType: 'object' },
        consultationSummary: { bsonType: 'object' },
        sourceData: { bsonType: 'object' },
        inputHash: { bsonType: 'string' },
        reportVersion: { bsonType: ['int', 'long', 'double'] },
        replacesReportId: { bsonType: 'objectId' },
        generatedAt: { bsonType: 'date' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  } satisfies Document,
} as const;

export const CC006_CARE_REPORT_INDEXES = [
  {
    collection: 'carereports',
    name: 'enrollment_1_type_1_windowStart_1_windowEnd_1_version_1',
    key: {
      patientCareProgramId: 1,
      reportType: 1,
      windowStart: 1,
      windowEnd: 1,
      reportVersion: 1,
    },
    unique: true,
  },
  {
    collection: 'carereports',
    name: 'patientId_1_generatedAt_-1__id_-1',
    key: { patientId: 1, generatedAt: -1, _id: -1 },
  },
  {
    collection: 'carereports',
    name: 'inputHash_1',
    key: { inputHash: 1 },
  },
  {
    collection: 'consultations',
    name: 'patientCareProgramId_1_requestedAt_1__id_1',
    key: { patientCareProgramId: 1, requestedAt: 1, _id: 1 },
  },
] as const;

export async function applyCc006CareReports(db: Db): Promise<void> {
  const exists = await db
    .listCollections(
      { name: CC006_CARE_REPORT_COLLECTION.name },
      { nameOnly: true },
    )
    .hasNext();
  if (!exists)
    await db.createCollection(CC006_CARE_REPORT_COLLECTION.name, {
      validator: CC006_CARE_REPORT_COLLECTION.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  else
    await db.command({
      collMod: CC006_CARE_REPORT_COLLECTION.name,
      validator: CC006_CARE_REPORT_COLLECTION.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  for (const index of CC006_CARE_REPORT_INDEXES)
    await db.collection(index.collection).createIndex(index.key, {
      name: index.name,
      ...('unique' in index ? { unique: index.unique } : {}),
    });
}
