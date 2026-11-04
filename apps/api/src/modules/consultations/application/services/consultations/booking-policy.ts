import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
  constructor(private readonly config: ConfigService) {}

  getScheduledPolicy(): ScheduledBookingPolicy {
    const bufferMinutes = this.config.get<number>(
      'SCHEDULED_BOOKING_BUFFER_MINUTES',
    );
    const minNoticeMinutes = this.config.get<number>(
      'SCHEDULED_BOOKING_MIN_NOTICE_MINUTES',
    );
    if (bufferMinutes === undefined || minNoticeMinutes === undefined) {
      throw new ServiceUnavailableException({
        code: 'BOOKING_POLICY_NOT_CONFIGURED',
        message:
          'Scheduled booking policy requires buffer and minimum notice configuration',
        details: {
          required: [
            'SCHEDULED_BOOKING_BUFFER_MINUTES',
            'SCHEDULED_BOOKING_MIN_NOTICE_MINUTES',
          ],
        },
      });
    }
    return {
      bookingPolicy: 'instant',
      bufferMinutes,
      minNoticeMinutes,
      cancellationDeadlineMinutes: 60,
      noShowAfterMinutes: 10,
    };
  }

  getCheckInEarlyMinutesIfConfigured(): number | undefined {
    return this.config.get<number>('CONSULTATION_CHECK_IN_EARLY_MINUTES');
  }

  getCheckInEarlyMinutes(): number {
    const minutes = this.getCheckInEarlyMinutesIfConfigured();
    if (minutes === undefined) {
      throw new ServiceUnavailableException({
        code: 'CHECK_IN_POLICY_NOT_CONFIGURED',
        message: 'Patient check-in requires an explicit early-window policy',
        details: { required: ['CONSULTATION_CHECK_IN_EARLY_MINUTES'] },
      });
    }
    return minutes;
  }
}

/** Retained for accepted/on-demand compatibility introduced by CC-013. */
export function defaultBookingSettingsSnapshot() {
  return { cancellationDeadlineMinutes: 60, noShowAfterMinutes: 10 };
}
