import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

/**
 * Historical RF-6 imports persisted absent optional timestamps as BSON null.
 * The current Consultation validator correctly accepts an optional timestamp
 * only when it is absent or a BSON date, so BSON null prevents a faithful
 * mongodump/mongorestore rehearsal. Unsetting null preserves the canonical
 * meaning (no timestamp) without manufacturing clinical or lifecycle data.
 */
export const CONSULTATION_NULL_TIMESTAMP_RECONCILIATION_VERSION = 202611171100;
export const CONSULTATION_NULL_TIMESTAMP_RECONCILIATION_NAME =
  'consultation-null-timestamp-reconciliation';

export const CONSULTATION_NULL_TIMESTAMP_FIELDS = [
  'respondedAt',
  'sessionStartedAt',
  'completedAt',
] as const;

export const CONSULTATION_NULL_TIMESTAMP_RECONCILIATION_CHECKSUM =
  migrationChecksum({
    version: CONSULTATION_NULL_TIMESTAMP_RECONCILIATION_VERSION,
    name: CONSULTATION_NULL_TIMESTAMP_RECONCILIATION_NAME,
    fields: CONSULTATION_NULL_TIMESTAMP_FIELDS,
    semantics: 'unset-optional-bson-null-timestamps-only',
  });

export async function applyConsultationNullTimestampReconciliation(
  db: Db,
): Promise<void> {
  const consultations = db.collection('consultations');
  await consultations.updateMany(
    {
      $or: CONSULTATION_NULL_TIMESTAMP_FIELDS.map((field) => ({
        [field]: { $type: 'null' },
      })),
    },
    [
      {
        $set: Object.fromEntries(
          CONSULTATION_NULL_TIMESTAMP_FIELDS.map((field) => [
            field,
            {
              $cond: [
                { $eq: [{ $type: `$${field}` }, 'null'] },
                '$$REMOVE',
                `$${field}`,
              ],
            },
          ]),
        ),
      },
    ],
  );
}
