/** Until per-doctor settings are implemented, confirmed bookings use these defaults. */
export function defaultBookingSettingsSnapshot() {
  return { cancellationDeadlineMinutes: 60, noShowAfterMinutes: 10 };
}
