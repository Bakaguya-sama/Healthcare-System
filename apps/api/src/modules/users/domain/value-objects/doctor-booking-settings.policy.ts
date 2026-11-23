import {
  DOCTOR_BOOKING_SETTINGS_LIMITS,
  type DoctorBookingSettings,
} from '../entities/doctors/doctor-profile.schema';

export type DoctorBookingSettingsInput = Pick<
  DoctorBookingSettings,
  | 'bookingPolicy'
  | 'bufferMinutes'
  | 'minNoticeMinutes'
  | 'cancellationDeadlineMinutes'
  | 'checkInEarlyMinutes'
  | 'noShowAfterMinutes'
>;

export class DoctorBookingSettingsPolicy {
  static validate(value: DoctorBookingSettingsInput): void {
    if (value.bookingPolicy !== 'instant') {
      throw new Error('Only instant booking is enabled for the current pilot');
    }
    for (const [field, limits] of Object.entries(
      DOCTOR_BOOKING_SETTINGS_LIMITS,
    ) as Array<
      [
        keyof typeof DOCTOR_BOOKING_SETTINGS_LIMITS,
        { min: number; max: number },
      ]
    >) {
      const numberValue = value[field];
      if (
        typeof numberValue !== 'number' ||
        !Number.isInteger(numberValue) ||
        numberValue < limits.min ||
        numberValue > limits.max
      ) {
        throw new Error(
          `${field} must be an integer from ${limits.min} to ${limits.max}`,
        );
      }
    }
  }
}
