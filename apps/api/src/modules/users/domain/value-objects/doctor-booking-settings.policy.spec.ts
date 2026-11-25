import { DoctorBookingSettingsPolicy } from './doctor-booking-settings.policy';

const valid = {
  bookingPolicy: 'instant' as const,
  bufferMinutes: 15,
  minNoticeMinutes: 60,
  cancellationDeadlineMinutes: 60,
  checkInEarlyMinutes: 15,
  noShowAfterMinutes: 10,
};

describe('DoctorBookingSettingsPolicy', () => {
  it('accepts the bounded instant pilot configuration', () => {
    expect(() => DoctorBookingSettingsPolicy.validate(valid)).not.toThrow();
  });

  it('rejects approval_required before its workflow is approved', () => {
    expect(() =>
      DoctorBookingSettingsPolicy.validate({
        ...valid,
        bookingPolicy: 'approval_required' as never,
      }),
    ).toThrow('Only instant booking');
  });

  it('rejects values beyond system hard limits', () => {
    expect(() =>
      DoctorBookingSettingsPolicy.validate({ ...valid, bufferMinutes: 61 }),
    ).toThrow('bufferMinutes');
  });
});
