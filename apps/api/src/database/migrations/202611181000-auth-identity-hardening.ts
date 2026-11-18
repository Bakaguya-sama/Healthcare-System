import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const AUTH_IDENTITY_HARDENING_VERSION = 202611181000;
export const AUTH_IDENTITY_HARDENING_NAME = 'auth-identity-hardening';
export const AUTH_IDENTITY_HARDENING_CHECKSUM = migrationChecksum({ version: AUTH_IDENTITY_HARDENING_VERSION, name: AUTH_IDENTITY_HARDENING_NAME, semantics: 'forward-only-email-verification-oauth-and-safe-session-indexes' });

export async function applyAuthIdentityHardening(db: Db): Promise<void> {
  await db.collection('users').updateMany({ accountStatus: { $exists: false } }, { $set: { accountStatus: 'active' } });
  await db.collection('email_verifications').updateMany({ purpose: { $exists: false } }, { $set: { purpose: 'email_verification' } });
  await db.collection('email_verifications').createIndex({ tokenHash: 1 }, { name: 'tokenHash_1', unique: true });
  await db.collection('email_verifications').createIndex({ userId: 1, consumedAt: 1, expiresAt: 1 }, { name: 'userId_1_consumedAt_1_expiresAt_1' });
  await db.collection('email_verifications').createIndex({ expiresAt: 1 }, { name: 'expiresAt_1', expireAfterSeconds: 0 });
  await db.collection('oauth_identities').createIndex({ provider: 1, providerAccountId: 1 }, { name: 'provider_1_providerAccountId_1', unique: true });
  await db.collection('oauth_identities').createIndex({ userId: 1 }, { name: 'userId_1' });
  await db.collection('oauth_states').createIndex({ stateHash: 1 }, { name: 'stateHash_1', unique: true });
  await db.collection('oauth_states').createIndex({ expiresAt: 1 }, { name: 'expiresAt_1', expireAfterSeconds: 0 });
  await db.collection('auth_sessions').createIndex({ familyId: 1, revokedAt: 1 }, { name: 'familyId_1_revokedAt_1' });
}
