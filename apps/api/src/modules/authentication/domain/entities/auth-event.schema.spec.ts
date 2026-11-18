import { AuthEventSchema } from './auth-event.schema';

describe('AuthEvent persistence redaction', () => {
  it('has no fields for email, IP, user agent, OTP, token or document URL', () => {
    const paths = Object.keys(AuthEventSchema.paths);
    for (const sensitivePath of [
      'email',
      'ipAddress',
      'userAgent',
      'otp',
      'token',
      'documentUrl',
    ]) {
      expect(paths).not.toContain(sensitivePath);
    }
  });
});
