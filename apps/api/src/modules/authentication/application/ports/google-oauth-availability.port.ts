export const GOOGLE_OAUTH_AVAILABILITY_PORT = Symbol(
  'GOOGLE_OAUTH_AVAILABILITY_PORT',
);

export interface GoogleOAuthAvailabilityPort {
  isEnabled(): boolean;
}
