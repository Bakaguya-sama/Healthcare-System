import { GoogleStrategy } from './google.strategy';

describe('GoogleStrategy OIDC identity mapping', () => {
  it('only treats the authenticated OIDC email_verified claim as verification evidence', () => {
    const principal = GoogleStrategy.prototype.validate.call(
      {},
      'ignored-access-token',
      'ignored-refresh-token',
      {
        id: 'synthetic-google-subject',
        displayName: 'Synthetic Patient',
        emails: [{ value: 'PATIENT@example.test' }],
        _json: { email_verified: true },
      } as never,
    );

    expect(principal).toEqual({
      provider: 'google',
      providerAccountId: 'synthetic-google-subject',
      email: 'patient@example.test',
      emailVerified: true,
      displayName: 'Synthetic Patient',
    });
  });

  it.each([undefined, false, 'true'])(
    'does not infer verification from the presence of an email when claim is %s',
    (claim) => {
      const principal = GoogleStrategy.prototype.validate.call(
        {},
        'ignored-access-token',
        'ignored-refresh-token',
        {
          id: 'synthetic-unverified-subject',
          emails: [{ value: 'patient@example.test' }],
          _json: { email_verified: claim },
        } as never,
      );
      expect(principal.email).toBe('patient@example.test');
      expect(principal.emailVerified).toBe(false);
    },
  );
});
