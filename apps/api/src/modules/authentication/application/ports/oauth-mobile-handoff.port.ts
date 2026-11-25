export type GooglePrincipal = {
  provider: 'google';
  providerAccountId: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
};

export type PendingGooglePrincipal = GooglePrincipal & {
  emailVerified: boolean;
};

export const OAUTH_MOBILE_HANDOFF_PORT = Symbol('OAUTH_MOBILE_HANDOFF_PORT');

export interface OAuthMobileHandoffPort {
  beginAttempt(challenge: string): Promise<{ attemptId: string }>;
  storeCallback(
    attemptId: string,
    principal: PendingGooglePrincipal,
  ): Promise<string>;
  consume(
    attemptId: string,
    ticket: string,
    verifier: string,
  ): Promise<PendingGooglePrincipal>;
}
