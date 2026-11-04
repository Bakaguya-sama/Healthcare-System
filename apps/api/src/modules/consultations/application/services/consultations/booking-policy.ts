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
 * CC-013 accepted cancellation/no-show values. Buffer and notice remain an
 * owner decision, so scheduled commands fail closed until both are configured.
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
}

/** Retained for accepted/on-demand compatibility introduced by CC-013. */
export function defaultBookingSettingsSnapshot() {
  return { cancellationDeadlineMinutes: 60, noShowAfterMinutes: 10 };
}
