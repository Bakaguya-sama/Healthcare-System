export const FAMILY_INVITATION_DAYS = 7;
export const FAMILY_SHORT_CODE_MINUTES = 15;
export const FAMILY_MAX_LINKS = 10;
export const FAMILY_REMINDER_GRACE_MINUTES = 60;
export const FAMILY_QUIET_START_HOUR = 21;
export const FAMILY_QUIET_END_HOUR = 8;

export type FamilyLinkStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'declined'
  | 'expired'
  | 'revoked';

export type FamilyReminderPermission =
  | 'missed_task_reminder'
  | 'weekly_progress';

export class FamilyPolicyError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function assertFamilyLinkLimit(limit: unknown, activeCount: number) {
  if (
    !Number.isInteger(limit) ||
    Number(limit) < 0 ||
    Number(limit) > FAMILY_MAX_LINKS
  )
    throw new FamilyPolicyError('FAMILY_ENTITLEMENT_UNAVAILABLE');
  if (activeCount >= Number(limit))
    throw new FamilyPolicyError('FAMILY_LINK_LIMIT_REACHED');
}

export function assertPatientAccount(
  role: string,
  accountStatus: string,
  emailVerifiedAt?: Date | null,
) {
  if (role !== 'patient' || accountStatus !== 'active' || !emailVerifiedAt)
    throw new FamilyPolicyError('FAMILY_CONTACT_NOT_ELIGIBLE');
}

export function assertNotSelf(patientId: string, contactId: string) {
  if (patientId === contactId)
    throw new FamilyPolicyError('FAMILY_SELF_INVITE_NOT_ALLOWED');
}

export function assertTransition(
  status: FamilyLinkStatus,
  action: 'accept' | 'decline' | 'pause' | 'resume' | 'revoke',
) {
  const allowed: Record<FamilyLinkStatus, string[]> = {
    pending: ['accept', 'decline', 'revoke'],
    active: ['pause', 'revoke'],
    paused: ['resume', 'revoke'],
    declined: [],
    expired: [],
    revoked: [],
  };
  if (!allowed[status].includes(action))
    throw new FamilyPolicyError('FAMILY_INVALID_STATE_TRANSITION');
}

export function assertFamilyTransitionActor(input: {
  action: 'accept' | 'decline' | 'pause' | 'resume' | 'revoke';
  actorId: string;
  patientId: string;
  familyUserId?: string;
  pendingRedeemerUserId?: string;
}) {
  const isPatient = input.actorId === input.patientId;
  const isContact = input.actorId === input.familyUserId;
  const isPendingRedeemer =
    !input.familyUserId && input.actorId === input.pendingRedeemerUserId;
  if (
    !isPatient &&
    !isContact &&
    !(['accept', 'decline'].includes(input.action) && isPendingRedeemer)
  )
    throw new FamilyPolicyError('FAMILY_LINK_FORBIDDEN');
  if ((input.action === 'pause' || input.action === 'resume') && !isPatient)
    throw new FamilyPolicyError('FAMILY_OWNER_ONLY');
  if (
    (input.action === 'accept' || input.action === 'decline') &&
    !isContact &&
    !isPendingRedeemer
  )
    throw new FamilyPolicyError('INVITED_CONTACT_ONLY');
}

export function isReminderPermission(
  value: unknown,
): value is FamilyReminderPermission {
  return value === 'missed_task_reminder' || value === 'weekly_progress';
}

export function normalizeReminderPermissions(
  values: unknown,
): FamilyReminderPermission[] {
  if (
    !Array.isArray(values) ||
    values.some((value) => !isReminderPermission(value))
  ) {
    throw new FamilyPolicyError('INVALID_FAMILY_PERMISSIONS');
  }
  return [...new Set(values)] as FamilyReminderPermission[];
}

export function normalizeExactLookup(value: string) {
  return value.trim().toLowerCase();
}

export function nextQuietHoursTime(now: Date, timeZone = 'Asia/Ho_Chi_Minh') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  if (hour >= FAMILY_QUIET_END_HOUR && hour < FAMILY_QUIET_START_HOUR)
    return now;
  const next = new Date(now);
  if (hour >= FAMILY_QUIET_START_HOUR) next.setUTCDate(next.getUTCDate() + 1);
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
  }).formatToParts(next);
  const y = Number(dateParts.find((part) => part.type === 'year')?.value);
  const m = Number(dateParts.find((part) => part.type === 'month')?.value);
  const d = Number(dateParts.find((part) => part.type === 'day')?.value);
  const localAsUtc = Date.UTC(y, m - 1, d, FAMILY_QUIET_END_HOUR);
  const representedParts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(localAsUtc));
  const represented = Object.fromEntries(
    representedParts.map((part) => [part.type, Number(part.value)]),
  );
  const representedAsUtc = Date.UTC(
    represented.year,
    represented.month - 1,
    represented.day,
    represented.hour,
    represented.minute,
    represented.second,
  );
  return new Date(localAsUtc - (representedAsUtc - localAsUtc));
}
