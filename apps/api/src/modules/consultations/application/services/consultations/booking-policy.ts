import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DoctorBookingSettingsService } from '../../../../users/public-api';

export type ScheduledBookingPolicy = {
  bookingPolicy: 'instant';
  bufferMinutes: number;
  minNoticeMinutes: number;
  cancellationDeadlineMinutes: number;
  noShowAfterMinutes: number;
};

/**
 * CC-013 accepted cancellation/no-show values. Buffer/notice use the owner's
 * pilot configuration; commands still fail closed if deployment omits them.
 */
@Injectable()
export class BookingPolicyService {
  constructor(private readonly doctorSettings: DoctorBookingSettingsService) {}

  async getScheduledPolicy(
    doctorId: string,
  ): Promise<ScheduledBookingPolicy & { checkInEarlyMinutes: number }> {
    try {
      const settings =
        await this.doctorSettings.getActiveScheduledPolicy(doctorId);
      return {
        bookingPolicy: settings.bookingPolicy,
        bufferMinutes: settings.bufferMinutes,
        minNoticeMinutes: settings.minNoticeMinutes,
        cancellationDeadlineMinutes: settings.cancellationDeadlineMinutes,
        noShowAfterMinutes: settings.noShowAfterMinutes,
        checkInEarlyMinutes: settings.checkInEarlyMinutes,
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'BOOKING_POLICY_NOT_CONFIGURED',
        message:
          'Doctor booking settings are required before scheduled booking is available',
      });
    }
  }
}

/** Retained for accepted/on-demand compatibility introduced by CC-013. */
export function defaultBookingSettingsSnapshot() {
  return { cancellationDeadlineMinutes: 60, noShowAfterMinutes: 10 };
}
