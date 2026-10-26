import type { Db, Document } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const CC002_CARE_TASKS_VERSION = 202609301000;
export const CC002_CARE_TASKS_NAME = 'cc002-care-tasks';
export const CC002_CARE_TASKS_CHECKSUM = migrationChecksum({
  version: CC002_CARE_TASKS_VERSION,
  name: CC002_CARE_TASKS_NAME,
  steps: ['create-care-task-collection', 'create-care-task-indexes'],
});

export const CC002_CARE_TASK_COLLECTION = {
  name: 'caretasks',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'patientCareProgramId',
        'patientId',
        'templateKey',
        'taskType',
        'status',
        'required',
        'scheduleVersion',
        'scheduledFor',
        'windowStart',
        'windowEnd',
        'completionRule',
        'reminderPolicy',
        'uniqueKey',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        patientCareProgramId: { bsonType: 'objectId' },
        patientId: { bsonType: 'objectId' },
        doctorId: { bsonType: 'objectId' },
        templateKey: { bsonType: 'string' },
        taskType: {
          enum: [
            'metric',
            'check_in',
            'education',
            'appointment',
            'doctor_review',
          ],
        },
        status: {
          enum: ['scheduled', 'due', 'completed', 'missed', 'cancelled'],
        },
        required: { bsonType: 'bool' },
        scheduleVersion: { bsonType: 'string' },
        scheduledFor: { bsonType: 'date' },
        windowStart: { bsonType: 'date' },
        windowEnd: { bsonType: 'date' },
        completionRule: { bsonType: 'object' },
        reminderPolicy: { bsonType: 'object' },
        completionSourceType: { bsonType: 'string' },
        completionSourceId: { bsonType: 'objectId' },
        response: { bsonType: 'object' },
        completedAt: { bsonType: 'date' },
        missedAt: { bsonType: 'date' },
        cancelledAt: { bsonType: 'date' },
        cancellationReason: { bsonType: 'string' },
        uniqueKey: { bsonType: 'string' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  } as Document,
};

export const CC002_CARE_TASK_INDEXES = [
  {
    collection: 'caretasks',
    name: 'uniqueKey_1',
    key: { uniqueKey: 1 },
    unique: true,
  },
  {
    collection: 'caretasks',
    name: 'patientId_1_status_1_scheduledFor_1',
    key: { patientId: 1, status: 1, scheduledFor: 1 },
  },
  {
    collection: 'caretasks',
    name: 'patientCareProgramId_1_status_1_windowStart_1',
    key: { patientCareProgramId: 1, status: 1, windowStart: 1 },
  },
  {
    collection: 'caretasks',
    name: 'doctorId_1_taskType_1_status_1_scheduledFor_1',
    key: { doctorId: 1, taskType: 1, status: 1, scheduledFor: 1 },
  },
  {
    collection: 'caretasks',
    name: 'completionSourceType_1_completionSourceId_1',
    key: { completionSourceType: 1, completionSourceId: 1 },
    sparse: true,
  },
] as const;

export async function applyCc002CareTasks(db: Db): Promise<void> {
  const exists = await db
    .listCollections(
      { name: CC002_CARE_TASK_COLLECTION.name },
      { nameOnly: true },
    )
    .hasNext();
  if (!exists)
    await db.createCollection(CC002_CARE_TASK_COLLECTION.name, {
      validator: CC002_CARE_TASK_COLLECTION.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  else
    await db.command({
      collMod: CC002_CARE_TASK_COLLECTION.name,
      validator: CC002_CARE_TASK_COLLECTION.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  for (const index of CC002_CARE_TASK_INDEXES)
    await db
      .collection(index.collection)
      .createIndex(index.key, {
        name: index.name,
        ...('unique' in index ? { unique: index.unique } : {}),
        ...('sparse' in index ? { sparse: index.sparse } : {}),
      });
}
