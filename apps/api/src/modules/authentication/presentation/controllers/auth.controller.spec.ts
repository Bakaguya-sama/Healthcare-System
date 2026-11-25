import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { GoogleOAuthError } from '../../application/errors/google-oauth.error';
import { AuthController } from './auth.controller';

describe('AuthController Google mobile endpoints', () => {
  const configValues: Record<string, unknown> = {
    GOOGLE_OAUTH_ENABLED: true,
    GOOGLE_OAUTH_MOBILE_REDIRECT_URL: 'healthcare://oauth/callback',
    API_PREFIX: 'api',
    API_VERSION: '1',
  };

  function setup() {
    const auth = {
      completeGooglePatientAuthentication: jest.fn().mockResolvedValue({
        accessToken: 'synthetic-access-token',
        refreshToken: 'synthetic-refresh-token',
        user: { id: 'synthetic-patient-id', role: 'patient', emailVerified: false },
      }),
    };
    const config = {
      get: (key: string) => configValues[key],
      getOrThrow: (key: string) => {
        const value = configValues[key];
        if (value === undefined) throw new Error(`Missing ${key}`);
        return value;
      },
    };
    const googleMobileOAuth = {
      beginAttempt: jest.fn().mockResolvedValue({ attemptId: 'a'.repeat(43) }),
      storeCallback: jest.fn().mockResolvedValue('t'.repeat(43)),
      exchange: jest.fn().mockResolvedValue({
        accessToken: 'synthetic-access-token',
        refreshToken: 'synthetic-refresh-token',
        user: { id: 'synthetic-patient-id', role: 'patient', emailVerified: false },
      }),
    };
    return {
      auth,
      config,
      googleMobileOAuth,
      controller: new AuthController(
        auth as never,
        config as unknown as ConfigService,
        googleMobileOAuth as never,
      ),
    };
  }

  it('returns a backend-generated attempt and relative authorize path', async () => {
    const { controller, googleMobileOAuth } = setup();
    await expect(
      controller.beginGoogleMobileOAuth({ challenge: 'c'.repeat(43) }),
    ).resolves.toEqual({
      attemptId: 'a'.repeat(43),
      authorizationPath: `/api/v1/auth/oauth/google?attemptId=${'a'.repeat(43)}`,
      expiresInSeconds: 300,
    });
    expect(googleMobileOAuth.beginAttempt).toHaveBeenCalledWith('c'.repeat(43));
  });

  it('renders a no-store ticket bridge without creating a session in the callback', async () => {
    const { controller, auth, googleMobileOAuth } = setup();
    const setHeader = jest.fn();
    const response = { setHeader } as unknown as Response;
    const request = {
      headers: { accept: 'text/html' },
      oauthAttemptId: 'a'.repeat(43),
      user: {
        provider: 'google',
        providerAccountId: 'synthetic-google-subject',
        email: 'synthetic@example.test',
        emailVerified: true,
      },
      get: jest.fn().mockReturnValue('synthetic-user-agent'),
    } as unknown as Parameters<
      AuthController['completeGooglePatientAuthentication']
    >[0];

    const html = await controller.completeGooglePatientAuthentication(
      request,
      response,
    );

    expect(googleMobileOAuth.storeCallback).toHaveBeenCalledWith(
      'a'.repeat(43),
      expect.objectContaining({
        providerAccountId: 'synthetic-google-subject',
        emailVerified: true,
      }),
    );
    expect(auth.completeGooglePatientAuthentication).not.toHaveBeenCalled();
    expect(html).toEqual(
      expect.stringContaining('healthcare://oauth/callback?ticket='),
    );
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(setHeader).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
  });

  it('exchanges the exact proof and marks the response private', async () => {
    const { controller, googleMobileOAuth } = setup();
    const setHeader = jest.fn();
    const response = { setHeader } as unknown as Response;
    const request = { get: jest.fn().mockReturnValue('synthetic-user-agent') } as unknown as Request;
    const dto = {
      attemptId: 'a'.repeat(43),
      ticket: 't'.repeat(43),
      verifier: 'v'.repeat(43),
    };

    await expect(
      controller.exchangeGoogleOAuthTicket(dto, request, response),
    ).resolves.toMatchObject({ user: { emailVerified: false } });
    expect(googleMobileOAuth.exchange).toHaveBeenCalledWith(
      dto.attemptId,
      dto.ticket,
      dto.verifier,
      { userAgent: 'synthetic-user-agent' },
    );
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('maps unavailable handoff storage without exposing infrastructure errors', async () => {
    const { controller, googleMobileOAuth } = setup();
    googleMobileOAuth.beginAttempt.mockRejectedValue(
      new GoogleOAuthError('GOOGLE_OAUTH_UNAVAILABLE'),
    );

    await expect(
      controller.beginGoogleMobileOAuth({ challenge: 'c'.repeat(43) }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    googleMobileOAuth.beginAttempt.mockRejectedValue(
      new GoogleOAuthError('GOOGLE_OAUTH_INVALID_CHALLENGE'),
    );
    await expect(
      controller.beginGoogleMobileOAuth({ challenge: 'c'.repeat(43) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
