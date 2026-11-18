import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const OAUTH_PROVIDER_EMAIL_UNIQUENESS_VERSION = 202611181220;
export const OAUTH_PROVIDER_EMAIL_UNIQUENESS_NAME =
  'oauth-provider-email-uniqueness';
export const OAUTH_PROVIDER_EMAIL_UNIQUENESS_CHECKSUM = migrationChecksum({
  version: OAUTH_PROVIDER_EMAIL_UNIQUENESS_VERSION,
  name: OAUTH_PROVIDER_EMAIL_UNIQUENESS_NAME,
  semantics: 'one-google-oauth-only-account-per-provider-email-when-present',
});

export async function applyOauthProviderEmailUniqueness(db: Db): Promise<void> {
  await db.collection('oauth_identities').createIndex(
    { provider: 1, providerEmail: 1 },
    {
      name: 'provider_1_providerEmail_1',
      unique: true,
      partialFilterExpression: { providerEmail: { $type: 'string' } },
    },
  );
}
