import type { Db, Document } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const CC003_CC004_EVALUATIONS_ALERTS_VERSION = 202610020900;
export const CC003_CC004_EVALUATIONS_ALERTS_NAME = 'cc003-cc004-evaluations-alerts';
export const CC003_CC004_EVALUATIONS_ALERTS_CHECKSUM = migrationChecksum({ version: CC003_CC004_EVALUATIONS_ALERTS_VERSION, name: CC003_CC004_EVALUATIONS_ALERTS_NAME, steps: ['create-health-evaluations', 'create-care-alerts', 'create-indexes'] });

const collections: Array<{ name: string; validator: Document; indexes: Array<{ name: string; key: Document; unique?: boolean }> }> = [
  { name: 'healthevaluations', validator: { $jsonSchema: { bsonType: 'object', required: ['patientCareProgramId', 'patientId', 'healthMetricId', 'careRuleId', 'severity', 'reasonCodes', 'inputData', 'timeRange', 'uniqueKey', 'evaluatedAt', 'createdAt'], properties: { patientCareProgramId: { bsonType: 'objectId' }, patientId: { bsonType: 'objectId' }, healthMetricId: { bsonType: 'objectId' }, careRuleId: { bsonType: 'objectId' }, severity: { enum: ['normal', 'attention', 'urgent'] }, reasonCodes: { bsonType: 'array' }, inputData: { bsonType: 'object' }, timeRange: { bsonType: 'object' }, uniqueKey: { bsonType: 'string' }, evaluatedAt: { bsonType: 'date' }, createdAt: { bsonType: 'date' } } } }, indexes: [{ name: 'uniqueKey_1', key: { uniqueKey: 1 }, unique: true }, { name: 'patientCareProgramId_1_evaluatedAt_-1', key: { patientCareProgramId: 1, evaluatedAt: -1 } }, { name: 'patientId_1_severity_1_evaluatedAt_-1', key: { patientId: 1, severity: 1, evaluatedAt: -1 } }, { name: 'careRuleId_1_evaluatedAt_-1', key: { careRuleId: 1, evaluatedAt: -1 } }] },
  { name: 'carealerts', validator: { $jsonSchema: { bsonType: 'object', required: ['revision', 'patientCareProgramId', 'evaluationId', 'patientId', 'assignedDoctorId', 'severity', 'status', 'reasonCodes', 'uniqueKey', 'detectedAt', 'createdAt'], properties: { revision: { bsonType: 'int' }, patientCareProgramId: { bsonType: 'objectId' }, evaluationId: { bsonType: 'objectId' }, patientId: { bsonType: 'objectId' }, assignedDoctorId: { bsonType: 'objectId' }, severity: { enum: ['attention', 'urgent'] }, status: { enum: ['open', 'acknowledged', 'resolved', 'dismissed'] }, reasonCodes: { bsonType: 'array' }, uniqueKey: { bsonType: 'string' }, detectedAt: { bsonType: 'date' }, createdAt: { bsonType: 'date' } } } }, indexes: [{ name: 'evaluationId_1', key: { evaluationId: 1 }, unique: true }, { name: 'uniqueKey_1', key: { uniqueKey: 1 }, unique: true }, { name: 'assignedDoctorId_1_status_1_severity_1_detectedAt_-1', key: { assignedDoctorId: 1, status: 1, severity: 1, detectedAt: -1 } }, { name: 'patientCareProgramId_1_detectedAt_-1', key: { patientCareProgramId: 1, detectedAt: -1 } }] },
];

export async function applyCc003Cc004EvaluationsAlerts(db: Db): Promise<void> {
  for (const collection of collections) {
    const exists = await db.listCollections({ name: collection.name }, { nameOnly: true }).hasNext();
    if (!exists) await db.createCollection(collection.name, { validator: collection.validator, validationLevel: 'strict', validationAction: 'error' });
    else await db.command({ collMod: collection.name, validator: collection.validator, validationLevel: 'strict', validationAction: 'error' });
    for (const index of collection.indexes) await db.collection(collection.name).createIndex(index.key, { name: index.name, ...(index.unique ? { unique: true } : {}) });
  }
}
