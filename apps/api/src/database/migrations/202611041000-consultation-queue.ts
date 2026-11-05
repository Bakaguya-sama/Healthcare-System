import type { Db, Document, IndexDescription } from 'mongodb';
import { migrationChecksum } from './migration.types';
import { SCHEDULED_BOOKING_CONSULTATION_COLLECTION } from './202611031000-scheduled-booking';

export const CONSULTATION_QUEUE_VERSION = 202611041000;
export const CONSULTATION_QUEUE_NAME = 'patient-check-in-doctor-queue';

export const CONSULTATION_QUEUE_COLLECTION = {
  ...SCHEDULED_BOOKING_CONSULTATION_COLLECTION,
  validator: {
    $jsonSchema: {
      ...SCHEDULED_BOOKING_CONSULTATION_COLLECTION.validator.$jsonSchema,
      properties: {
        ...SCHEDULED_BOOKING_CONSULTATION_COLLECTION.validator.$jsonSchema
          .properties,
        checkInKey: { bsonType: 'string', maxLength: 64 },
        checkInRequestHash: { bsonType: 'string', maxLength: 64 },
        lastCallNextKey: { bsonType: 'string', maxLength: 64 },
        lastCallNextRequestHash: { bsonType: 'string', maxLength: 64 },
      },
    },
  },
} as const;

export const CONSULTATION_QUEUE_INDEXES: ReadonlyArray<
  IndexDescription & { collection: string; name: string }
> = [
  {
    collection: 'consultations',
    name: 'doctor_queue_order',
    key: {
      doctorId: 1,
      requestStatus: 1,
      sessionStatus: 1,
      queuePriorityAt: 1,
      queueJoinedAt: 1,
      _id: 1,
    },
  },
  {
    collection: 'consultations',
    name: 'one_called_waiting_per_doctor',
    key: { doctorId: 1 },
    unique: true,
    partialFilterExpression: {
      requestStatus: 'accepted',
      sessionStatus: 'waiting',
      calledAt: { $type: 'date' },
    },
  },
  {
    collection: 'consultations',
    name: 'one_active_consultation_per_doctor',
    key: { doctorId: 1 },
    unique: true,
    partialFilterExpression: { sessionStatus: 'in_consultation' },
  },
  {
    collection: 'consultations',
    name: 'checkInKey_1',
    key: { checkInKey: 1 },
    unique: true,
    sparse: true,
  },
  {
    collection: 'consultations',
    name: 'lastCallNextKey_1',
    key: { lastCallNextKey: 1 },
    unique: true,
    sparse: true,
  },
] as const;

export const CONSULTATION_QUEUE_CHECKSUM = migrationChecksum({
  version: CONSULTATION_QUEUE_VERSION,
  name: CONSULTATION_QUEUE_NAME,
  validator: CONSULTATION_QUEUE_COLLECTION.validator,
  indexes: CONSULTATION_QUEUE_INDEXES,
});

export async function applyConsultationQueue(db: Db): Promise<void> {
  await db.command({
    collMod: CONSULTATION_QUEUE_COLLECTION.name,
    validator: CONSULTATION_QUEUE_COLLECTION.validator as Document,
    validationLevel: 'strict',
    validationAction: 'error',
  });

  for (const {
    collection,
    key,
    name,
    ...options
  } of CONSULTATION_QUEUE_INDEXES) {
    await db.collection(collection).createIndex(key, { name, ...options });
  }
}
