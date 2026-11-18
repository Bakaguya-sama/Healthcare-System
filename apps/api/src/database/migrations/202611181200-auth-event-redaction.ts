import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';
export const AUTH_EVENT_REDACTION_VERSION = 202611181200;
export const AUTH_EVENT_REDACTION_NAME = 'auth-event-redaction';
export const AUTH_EVENT_REDACTION_CHECKSUM = migrationChecksum({ version: AUTH_EVENT_REDACTION_VERSION, name: AUTH_EVENT_REDACTION_NAME, semantics: 'remove-legacy-email-ip-and-user-agent-from-auth-events' });
export async function applyAuthEventRedaction(db: Db): Promise<void> {
  await db.collection('auth_events').updateMany({ $or: [{ email: { $exists: true } }, { ipAddress: { $exists: true } }, { userAgent: { $exists: true } }] }, { $unset: { email: '', ipAddress: '', userAgent: '' } });
}
