import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const E1_DOCTOR_BOOKING_SETTINGS_VERSION = 202611231000;
export const E1_DOCTOR_BOOKING_SETTINGS_NAME = 'e1-doctor-booking-settings';
export const E1_DOCTOR_BOOKING_SETTINGS_CHECKSUM = migrationChecksum({
  version: E1_DOCTOR_BOOKING_SETTINGS_VERSION,
  name: E1_DOCTOR_BOOKING_SETTINGS_NAME,
  steps: ['provision-canonical-settings-for-existing-doctor-profiles'],
});

/**
 * This establishes the canonical policy for existing doctors without mutating
 * historic consultation snapshots. Re-running is a no-op because the filter
 * only targets profiles where bookingSettings is absent.
 */
export async function applyE1DoctorBookingSettings(db: Db): Promise<void> {
  const now = new Date();
  await db.collection('users').updateMany(
    {
      role: 'doctor',
      doctorProfile: { $exists: true },
      'doctorProfile.bookingSettings': { $exists: false },
    },
    {
      $set: {
        'doctorProfile.bookingSettings': {
          bookingPolicy: 'instant',
          bufferMinutes: 0,
          minNoticeMinutes: 0,
          cancellationDeadlineMinutes: 60,
          checkInEarlyMinutes: 0,
          noShowAfterMinutes: 10,
          effectiveFrom: now,
          updatedAt: now,
          updatedBy: 'migration:e1-doctor-booking-settings',
        },
      },
    },
  );
}
