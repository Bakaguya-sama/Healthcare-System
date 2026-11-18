import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';
export const AUTH_OTP_COOKIE_CLEANUP_VERSION = 202611181100;
export const AUTH_OTP_COOKIE_CLEANUP_NAME = 'auth-otp-cookie-state-cleanup';
export const AUTH_OTP_COOKIE_CLEANUP_CHECKSUM = migrationChecksum({ version: AUTH_OTP_COOKIE_CLEANUP_VERSION, name: AUTH_OTP_COOKIE_CLEANUP_NAME, semantics: 'remove-superseded-email-verification-and-oauth-state-collections' });
export async function applyAuthOtpCookieCleanup(db: Db): Promise<void> {
  for (const name of ['email_verifications', 'oauth_states']) {
    const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
    if (exists) await db.collection(name).drop();
  }
}
