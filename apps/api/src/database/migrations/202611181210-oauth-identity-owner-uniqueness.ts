import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const OAUTH_IDENTITY_OWNER_UNIQUENESS_VERSION = 202611181210;
export const OAUTH_IDENTITY_OWNER_UNIQUENESS_NAME =
  'oauth-identity-owner-uniqueness';
export const OAUTH_IDENTITY_OWNER_UNIQUENESS_CHECKSUM = migrationChecksum({
  version: OAUTH_IDENTITY_OWNER_UNIQUENESS_VERSION,
  name: OAUTH_IDENTITY_OWNER_UNIQUENESS_NAME,
  semantics: 'one-google-identity-link-per-owner',
});

export async function applyOauthIdentityOwnerUniqueness(db: Db): Promise<void> {
  await db.collection('oauth_identities').createIndex(
    { userId: 1, provider: 1 },
    { name: 'userId_1_provider_1', unique: true },
  );
}
