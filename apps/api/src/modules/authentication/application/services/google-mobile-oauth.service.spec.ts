import { GoogleMobileOAuthService } from './google-mobile-oauth.service';
import { GoogleOAuthError } from '../errors/google-oauth.error';

describe('GoogleMobileOAuthService', () => {
  function setup(enabled = true) {
    const handoff = {
      beginAttempt: jest.fn().mockResolvedValue({ attemptId: 'attempt' }),
      storeCallback: jest.fn().mockResolvedValue('ticket'),
      consume: jest.fn().mockResolvedValue({
        provider: 'google',
        providerAccountId: 'provider-subject',
        emailVerified: true,
      }),
    };
    const availability = { isEnabled: jest.fn().mockReturnValue(enabled) };
    const auth = {
      completeGooglePatientAuthentication: jest
        .fn()
        .mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }),
    };
    return {
      handoff,
      availability,
      auth,
      service: new GoogleMobileOAuthService(
        handoff,
        availability,
        auth as never,
      ),
    };
  }

  it('checks the availability port before creating a mobile attempt', () => {
    const { service, handoff } = setup(false);

    expect(() => service.beginAttempt('challenge')).toThrow(GoogleOAuthError);
    expect(handoff.beginAttempt).not.toHaveBeenCalled();
  });

  it('consumes the proof-bound handoff before creating the patient session', async () => {
    const { service, handoff, auth } = setup();

    await service.exchange('attempt', 'ticket', 'verifier', {});

    expect(handoff.consume).toHaveBeenCalledWith('attempt', 'ticket', 'verifier');
    expect(auth.completeGooglePatientAuthentication).toHaveBeenCalledWith(
      expect.objectContaining({ providerAccountId: 'provider-subject' }),
      {},
    );
  });
});
