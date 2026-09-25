import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const RF6_CONSULTATIONS_VERSION = 202609182100;
export const RF6_CONSULTATIONS_NAME = 'rf6-consultations';
export const RF6_CONSULTATIONS_CHECKSUM = migrationChecksum({
  version: RF6_CONSULTATIONS_VERSION,
  name: RF6_CONSULTATIONS_NAME,
  steps: ['copy-sessions', 'create-consultation-indexes'],
});

export async function applyRf6Consultations(db: Db): Promise<void> {
  const sessions = db.collection('sessions');
  const consultations = db.collection('consultations');
  const legacy = await sessions.find({}).toArray();
  for (const session of legacy) {
    const requestStatus = session.status === 'pending'
      ? 'pending'
      : session.status === 'rejected'
        ? 'declined'
        : 'accepted';
    const sessionStatus = session.status === 'completed'
      ? 'completed'
      : session.status === 'rejected'
        ? 'cancelled'
        : session.startedAt
          ? 'in_progress'
          : session.status === 'pending' ? 'not_started' : 'confirmed';
    await consultations.updateOne(
      { _id: session._id },
      {
        $setOnInsert: {
          _id: session._id,
          patientId: session.patientId,
          doctorId: session.doctorId,
          mode: 'on_demand',
          requestStatus,
          sessionStatus,
          requestedAt: session.createdAt ?? new Date(),
          respondedAt: session.status === 'pending' ? undefined : session.updatedAt ?? new Date(),
          scheduledStartAt: session.scheduledAt,
          patientNotes: session.patientNotes,
          doctorNotes: session.doctorNotes,
          sessionStartedAt: session.startedAt,
          completedAt: session.endedAt,
          lastMessageAt: session.lastMessageAt,
          lastMessageId: session.lastMessageId,
          createdAt: session.createdAt ?? new Date(),
          updatedAt: session.updatedAt ?? new Date(),
        },
      },
      { upsert: true },
    );
  }
  await consultations.createIndex({ doctorId: 1, requestStatus: 1, requestedAt: -1, _id: -1 }, { name: 'doctorId_1_requestStatus_1_requestedAt_-1__id_-1' });
  await consultations.createIndex({ patientId: 1, requestStatus: 1, requestedAt: -1, _id: -1 }, { name: 'patientId_1_requestStatus_1_requestedAt_-1__id_-1' });
  await consultations.createIndex({ doctorId: 1, sessionStatus: 1, scheduledStartAt: 1, _id: 1 }, { name: 'doctorId_1_sessionStatus_1_scheduledStartAt_1__id_1' });
  await consultations.createIndex({ patientId: 1, doctorId: 1, requestStatus: 1 }, { name: 'patientId_1_doctorId_1_requestStatus_1', unique: true, partialFilterExpression: { mode: 'on_demand', requestStatus: 'pending' } });
  await consultations.createIndex({ roomId: 1 }, { name: 'roomId_1', unique: true, sparse: true });
}
