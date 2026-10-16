import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const CC008_CARE_ALERT_CONSULTATION_LINK_VERSION = 202610161000;
export const CC008_CARE_ALERT_CONSULTATION_LINK_NAME =
  'cc008-care-alert-consultation-link';
export const CC008_CARE_ALERT_CONSULTATION_LINK_CHECKSUM = migrationChecksum({
  version: CC008_CARE_ALERT_CONSULTATION_LINK_VERSION,
  name: CC008_CARE_ALERT_CONSULTATION_LINK_NAME,
  steps: ['verify-one-consultation-per-care-alert', 'create-care-alert-link-index'],
});

export const CC008_CARE_ALERT_CONSULTATION_INDEX = {
  collection: 'consultations',
  name: 'careAlertId_1_unique',
  key: { careAlertId: 1 },
  unique: true,
  sparse: true,
} as const;

export async function applyCc008CareAlertConsultationLink(db: Db) {
  const consultations = db.collection(CC008_CARE_ALERT_CONSULTATION_INDEX.collection);
  const duplicates = await consultations
    .aggregate([
      { $match: { careAlertId: { $exists: true } } },
      { $group: { _id: '$careAlertId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 },
    ])
    .toArray();
  if (duplicates.length) {
    throw new Error(
      'Cannot enforce one consultation per care alert: duplicate careAlertId exists',
    );
  }
  await consultations.createIndex(CC008_CARE_ALERT_CONSULTATION_INDEX.key, {
    name: CC008_CARE_ALERT_CONSULTATION_INDEX.name,
    unique: CC008_CARE_ALERT_CONSULTATION_INDEX.unique,
    sparse: CC008_CARE_ALERT_CONSULTATION_INDEX.sparse,
  });
}
