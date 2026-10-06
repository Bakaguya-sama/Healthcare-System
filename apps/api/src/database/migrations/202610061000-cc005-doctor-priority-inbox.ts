import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const CC005_DOCTOR_PRIORITY_INBOX_VERSION = 202610061000;
export const CC005_DOCTOR_PRIORITY_INBOX_NAME = 'cc005-doctor-priority-inbox';
export const CC005_DOCTOR_PRIORITY_INBOX_CHECKSUM = migrationChecksum({
  version: CC005_DOCTOR_PRIORITY_INBOX_VERSION,
  name: CC005_DOCTOR_PRIORITY_INBOX_NAME,
  steps: ['create-doctor-inbox-index'],
});

export const CC005_DOCTOR_PRIORITY_INBOX_INDEX = {
  collection: 'carealerts',
  name: 'assignedDoctorId_1_severity_-1_detectedAt_-1__id_-1',
  key: { assignedDoctorId: 1, severity: -1, detectedAt: -1, _id: -1 },
} as const;

export async function applyCc005DoctorPriorityInbox(db: Db): Promise<void> {
  await db
    .collection(CC005_DOCTOR_PRIORITY_INBOX_INDEX.collection)
    .createIndex(CC005_DOCTOR_PRIORITY_INBOX_INDEX.key, {
      name: CC005_DOCTOR_PRIORITY_INBOX_INDEX.name,
    });
}
