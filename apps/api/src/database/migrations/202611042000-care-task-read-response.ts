import type { Db, Document } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const CARE_TASK_READ_RESPONSE_VERSION = 202611042000;
export const CARE_TASK_READ_RESPONSE_NAME = 'care-task-read-response';

export const CARE_TASK_COMMAND_IDEMPOTENCY_VALIDATOR: Document = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'actorId',
      'operation',
      'key',
      'requestHash',
      'entityType',
      'entityId',
      'createdAt',
      'updatedAt',
    ],
    properties: {
      actorId: { bsonType: 'objectId' },
      operation: { bsonType: 'string' },
      key: { bsonType: 'string' },
      requestHash: { bsonType: 'string' },
      entityType: {
        enum: ['careProgram', 'careRule', 'careEnrollment', 'careTask'],
      },
      entityId: { bsonType: 'objectId' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
    },
  },
};

export const CARE_TASK_READ_RESPONSE_INDEXES = [
  {
    collection: 'caretasks',
    name: 'patientCareProgramId_1_scheduledFor_1__id_1',
    key: { patientCareProgramId: 1, scheduledFor: 1, _id: 1 },
  },
] as const;

export const CARE_TASK_READ_RESPONSE_CHECKSUM = migrationChecksum({
  version: CARE_TASK_READ_RESPONSE_VERSION,
  name: CARE_TASK_READ_RESPONSE_NAME,
  steps: [
    'extend-care-command-idempotency-for-care-task',
    'create-care-task-stable-list-index',
  ],
});

export async function applyCareTaskReadResponse(db: Db): Promise<void> {
  await db.command({
    collMod: 'carecommandidempotencies',
    validator: CARE_TASK_COMMAND_IDEMPOTENCY_VALIDATOR,
    validationLevel: 'strict',
    validationAction: 'error',
  });
  for (const index of CARE_TASK_READ_RESPONSE_INDEXES)
    await db
      .collection(index.collection)
      .createIndex(index.key, { name: index.name });
}
