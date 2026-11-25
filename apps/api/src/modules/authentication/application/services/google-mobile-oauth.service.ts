import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleOAuthError } from '../errors/google-oauth.error';
import { OAUTH_MOBILE_HANDOFF_PORT } from '../ports/oauth-mobile-handoff.port';
import { GOOGLE_OAUTH_AVAILABILITY_PORT } from '../ports/google-oauth-availability.port';
import type {
  OAuthMobileHandoffPort,
  PendingGooglePrincipal,
} from '../ports/oauth-mobile-handoff.port';
import type { GoogleOAuthAvailabilityPort } from '../ports/google-oauth-availability.port';

@Injectable()
export class GoogleMobileOAuthService {
  constructor(
    @Inject(OAUTH_MOBILE_HANDOFF_PORT)
    private readonly handoff: OAuthMobileHandoffPort,
    @Inject(GOOGLE_OAUTH_AVAILABILITY_PORT)
    private readonly availability: GoogleOAuthAvailabilityPort,
    private readonly auth: AuthService,
  ) {}

  beginAttempt(challenge: string) {
    this.ensureProviderEnabled();
    return this.handoff.beginAttempt(challenge);
  }

  storeCallback(attemptId: string, principal: PendingGooglePrincipal) {
    this.ensureProviderEnabled();
    return this.handoff.storeCallback(attemptId, principal);
  }

  async exchange(
    attemptId: string,
    ticket: string,
    verifier: string,
    meta: { userAgent?: string },
  ) {
    this.ensureProviderEnabled();
    const principal = await this.handoff.consume(attemptId, ticket, verifier);
    return this.auth.completeGooglePatientAuthentication(principal, meta);
  }

  private ensureProviderEnabled() {
    if (!this.availability.isEnabled())
      throw new GoogleOAuthError('GOOGLE_OAUTH_UNAVAILABLE');
  }
}
