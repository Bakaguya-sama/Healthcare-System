import type { Db, Document } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const DATA001A_CONSULTATION_CONTRACT_VERSION = 202610152000;
export const DATA001A_CONSULTATION_CONTRACT_NAME =
  'data001a-consultation-contract';
export const DATA001A_CONSULTATION_CONTRACT_CHECKSUM = migrationChecksum({
  version: DATA001A_CONSULTATION_CONTRACT_VERSION,
  name: DATA001A_CONSULTATION_CONTRACT_NAME,
  steps: [
    'normalize-legacy-consultation-session-statuses',
    'backfill-required-consultation-fields',
    'apply-consultation-target-validator-and-indexes',
  ],
});

export const DATA001A_CONSULTATION_COLLECTION = {
  name: 'consultations',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'patientId',
        'doctorId',
        'mode',
        'requestStatus',
        'sessionStatus',
        'requestedAt',
        'expectedDurationMinutes',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        patientId: { bsonType: 'objectId' },
        doctorId: { bsonType: 'objectId' },
        patientCareProgramId: { bsonType: 'objectId' },
        careAlertId: { bsonType: 'objectId' },
        availabilitySlotId: { bsonType: 'objectId' },
        mode: { enum: ['on_demand', 'scheduled'] },
        requestStatus: {
          enum: ['pending', 'accepted', 'declined', 'cancelled', 'expired'],
        },
        sessionStatus: {
          enum: [
            'not_started',
            'waiting',
            'in_consultation',
            'interrupted',
            'completed',
            'no_show',
          ],
        },
        requestedAt: { bsonType: 'date' },
        respondedAt: { bsonType: 'date' },
        requestExpiresAt: { bsonType: 'date' },
        declinedReason: { bsonType: 'string' },
        scheduledStartAt: { bsonType: 'date' },
        scheduledEndAt: { bsonType: 'date' },
        timezone: { bsonType: 'string' },
        expectedDurationMinutes: { bsonType: ['int', 'long', 'double'] },
        estimatedWaitMinutes: { bsonType: ['int', 'long', 'double'] },
        overtimeStartedAt: { bsonType: 'date' },
        bookingSettingsSnapshot: { bsonType: 'object' },
        followUp: { bsonType: 'object' },
        queueJoinedAt: { bsonType: 'date' },
        queuePriorityAt: { bsonType: 'date' },
        calledAt: { bsonType: 'date' },
        sessionStartedAt: { bsonType: 'date' },
        interruptedAt: { bsonType: 'date' },
        interruptionReason: { bsonType: 'string' },
        resumedAt: { bsonType: 'date' },
        completedAt: { bsonType: 'date' },
        completedBy: { bsonType: 'objectId' },
        noShowAt: { bsonType: 'date' },
        noShowReason: { bsonType: 'string' },
        cancelledAt: { bsonType: 'date' },
        cancelledBy: { bsonType: 'objectId' },
        cancellationReason: { bsonType: 'string' },
        roomId: { bsonType: 'string' },
        callStartedAt: { bsonType: 'date' },
        callEndedAt: { bsonType: 'date' },
        callEndReason: { bsonType: 'string' },
        consultationConsent: { bsonType: 'object' },
        aiConsultationBrief: { bsonType: 'object' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  } satisfies Document,
} as const;

export const DATA001A_CONSULTATION_INDEXES = [
  {
    collection: 'consultations',
    name: 'availabilitySlotId_1',
    key: { availabilitySlotId: 1 },
    unique: true,
    sparse: true,
  },
  {
    collection: 'consultations',
    name: 'doctorId_1_sessionStatus_1_scheduledStartAt_1_queuePriorityAt_1__id_1',
    key: {
      doctorId: 1,
      sessionStatus: 1,
      scheduledStartAt: 1,
      queuePriorityAt: 1,
      _id: 1,
    },
  },
] as const;

export async function applyData001aConsultationContract(db: Db) {
  const exists = await db
    .listCollections({ name: DATA001A_CONSULTATION_COLLECTION.name }, {
      nameOnly: true,
    })
    .hasNext();
  if (!exists) {
    await db.createCollection(DATA001A_CONSULTATION_COLLECTION.name, {
      validator: DATA001A_CONSULTATION_COLLECTION.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  } else {
    const consultations = db.collection(DATA001A_CONSULTATION_COLLECTION.name);
    await consultations.updateMany(
      { sessionStatus: { $in: ['confirmed', 'in_progress', 'cancelled'] } },
      [
        {
          $set: {
            sessionStatus: {
              $switch: {
                branches: [
                  { case: { $eq: ['$sessionStatus', 'confirmed'] }, then: 'waiting' },
                  {
                    case: { $eq: ['$sessionStatus', 'in_progress'] },
                    then: 'in_consultation',
                  },
                ],
                default: 'not_started',
              },
            },
          },
        },
      ],
    );
    await consultations.updateMany(
      { expectedDurationMinutes: { $exists: false } },
      { $set: { expectedDurationMinutes: 30 } },
    );
    await db.command({
      collMod: DATA001A_CONSULTATION_COLLECTION.name,
      validator: DATA001A_CONSULTATION_COLLECTION.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  }

  for (const index of DATA001A_CONSULTATION_INDEXES) {
    await db.collection(index.collection).createIndex(index.key, {
      name: index.name,
      ...('unique' in index ? { unique: index.unique } : {}),
      ...('sparse' in index ? { sparse: index.sparse } : {}),
    });
  }
}
