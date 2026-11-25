export type GoogleOAuthErrorCode =
  | 'GOOGLE_OAUTH_UNAVAILABLE'
  | 'GOOGLE_OAUTH_INVALID_CHALLENGE'
  | 'GOOGLE_OAUTH_HANDOFF_INVALID';

/** Transport-neutral error crossing the OAuth application boundary. */
export class GoogleOAuthError extends Error {
  constructor(readonly code: GoogleOAuthErrorCode) {
    super(code);
    this.name = 'GoogleOAuthError';
  }
}
