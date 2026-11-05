import type { Db, Document } from 'mongodb';
import { CC013B_CONSULTATION_COLLECTION } from './202610201100-cc013b-stale-consultation-recovery';
import { migrationChecksum } from './migration.types';

export const SCHEDULED_BOOKING_VERSION = 202611031000;
export const SCHEDULED_BOOKING_NAME = 'scheduled-booking-availability-slots';

const date = { bsonType: 'date' } as const;
const objectId = { bsonType: 'objectId' } as const;

export const SCHEDULED_BOOKING_COLLECTIONS: ReadonlyArray<{
  name: string;
  validator: Document;
}> = [
  {
    name: 'availabilityslots',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: [
          'doctorId',
          'startAt',
          'endAt',
          'timezone',
          'status',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          doctorId: objectId,
          startAt: date,
          endAt: date,
          timezone: { bsonType: 'string', maxLength: 64 },
          status: { enum: ['available', 'booked', 'blocked', 'expired'] },
          blockedAt: date,
          blockedBy: objectId,
          blockReason: { bsonType: 'string', maxLength: 500 },
          createdAt: date,
          updatedAt: date,
        },
      },
      $expr: { $lt: ['$startAt', '$endAt'] },
    },
  },
  {
    name: 'availabilityslotlocks',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['doctorId', 'revision', 'createdAt', 'updatedAt'],
        properties: {
          doctorId: objectId,
          revision: {
            bsonType: ['int', 'long', 'double', 'decimal'],
            minimum: 0,
          },
          createdAt: date,
          updatedAt: date,
        },
      },
    },
  },
] as const;

export const SCHEDULED_BOOKING_CONSULTATION_COLLECTION = {
  ...CC013B_CONSULTATION_COLLECTION,
  validator: {
    $jsonSchema: {
      ...CC013B_CONSULTATION_COLLECTION.validator.$jsonSchema,
      properties: {
        ...CC013B_CONSULTATION_COLLECTION.validator.$jsonSchema.properties,
        scheduledBookingKey: { bsonType: 'string', maxLength: 64 },
        scheduledBookingRequestHash: { bsonType: 'string', maxLength: 64 },
        lastRescheduleKey: { bsonType: 'string', maxLength: 64 },
        lastRescheduleRequestHash: { bsonType: 'string', maxLength: 64 },
      },
    },
  },
} as const;

export const SCHEDULED_BOOKING_INDEXES = [
  {
    collection: 'availabilityslots',
    name: 'doctorId_1_startAt_1',
    key: { doctorId: 1, startAt: 1 },
    unique: true,
  },
  {
    collection: 'availabilityslots',
    name: 'doctorId_1_status_1_startAt_1__id_1',
    key: { doctorId: 1, status: 1, startAt: 1, _id: 1 },
  },
  {
    collection: 'availabilityslotlocks',
    name: 'doctorId_1',
    key: { doctorId: 1 },
    unique: true,
  },
  {
    collection: 'consultations',
    name: 'scheduledBookingKey_1',
    key: { scheduledBookingKey: 1 },
    unique: true,
    sparse: true,
  },
] as const;

export const SCHEDULED_BOOKING_CHECKSUM = migrationChecksum({
  version: SCHEDULED_BOOKING_VERSION,
  name: SCHEDULED_BOOKING_NAME,
  collections: SCHEDULED_BOOKING_COLLECTIONS,
  consultationValidator: SCHEDULED_BOOKING_CONSULTATION_COLLECTION.validator,
  indexes: SCHEDULED_BOOKING_INDEXES,
});

export async function applyScheduledBooking(db: Db): Promise<void> {
  for (const definition of SCHEDULED_BOOKING_COLLECTIONS) {
    const exists = await db
      .listCollections({ name: definition.name }, { nameOnly: true })
      .hasNext();
    if (!exists) {
      await db.createCollection(definition.name, {
        validator: definition.validator,
        validationLevel: 'strict',
        validationAction: 'error',
      });
    } else {
      await db.command({
        collMod: definition.name,
        validator: definition.validator,
        validationLevel: 'strict',
        validationAction: 'error',
      });
    }
  }

  await db.command({
    collMod: SCHEDULED_BOOKING_CONSULTATION_COLLECTION.name,
    validator: SCHEDULED_BOOKING_CONSULTATION_COLLECTION.validator,
    validationLevel: 'strict',
    validationAction: 'error',
  });

  for (const index of SCHEDULED_BOOKING_INDEXES) {
    await db.collection(index.collection).createIndex(index.key, {
      name: index.name,
      ...('unique' in index ? { unique: index.unique } : {}),
      ...('sparse' in index ? { sparse: index.sparse } : {}),
    });
  }
}
