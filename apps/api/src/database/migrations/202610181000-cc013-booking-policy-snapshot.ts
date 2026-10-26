import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const CC013_BOOKING_POLICY_VERSION = 202610181000;
export const CC013_BOOKING_POLICY_NAME = 'cc013-booking-policy-snapshot';
export const CC013_BOOKING_POLICY_CHECKSUM = migrationChecksum({
  version: CC013_BOOKING_POLICY_VERSION,
  name: CC013_BOOKING_POLICY_NAME,
  steps: ['backfill-missing-confirmed-scheduled-policy'],
});

export async function applyCc013BookingPolicy(db: Db) {
  await db
    .collection('consultations')
    .updateMany(
      {
        mode: 'scheduled',
        requestStatus: 'accepted',
        sessionStatus: 'waiting',
        bookingSettingsSnapshot: { $exists: false },
      },
      {
        $set: {
          bookingSettingsSnapshot: {
            cancellationDeadlineMinutes: 60,
            noShowAfterMinutes: 10,
          },
        },
      },
    );
}
