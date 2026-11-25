import {
  assertFamilyLinkLimit,
  assertFamilyTransitionActor,
  assertNotSelf,
  assertPatientAccount,
  assertTransition,
  isReminderPermission,
  nextQuietHoursTime,
  normalizeExactLookup,
} from './family-companion.policy';

describe('family companion policy', () => {
  it('enforces configured entitlement and technical ceiling', () => {
    expect(() => assertFamilyLinkLimit(3, 2)).not.toThrow();
    expect(() => assertFamilyLinkLimit(3, 3)).toThrow(
      'FAMILY_LINK_LIMIT_REACHED',
    );
    expect(() => assertFamilyLinkLimit(11, 0)).toThrow(
      'FAMILY_ENTITLEMENT_UNAVAILABLE',
    );
  });

  it('requires an active verified Patient contact and rejects self-invite', () => {
    expect(() =>
      assertPatientAccount('patient', 'active', new Date()),
    ).not.toThrow();
    expect(() =>
      assertPatientAccount('patient', 'pending_verification', new Date()),
    ).toThrow('FAMILY_CONTACT_NOT_ELIGIBLE');
    expect(() => assertNotSelf('a', 'a')).toThrow(
      'FAMILY_SELF_INVITE_NOT_ALLOWED',
    );
  });

  it('keeps state transitions fail-closed and allowlists reminder permissions', () => {
    expect(() => assertTransition('pending', 'accept')).not.toThrow();
    expect(() => assertTransition('active', 'accept')).toThrow(
      'FAMILY_INVALID_STATE_TRANSITION',
    );
    expect(isReminderPermission('missed_task_reminder')).toBe(true);
    expect(isReminderPermission('health_metric')).toBe(false);
  });

  it('allows a redeemed contact to decline but reserves pause for the owner', () => {
    const base = {
      actorId: 'contact',
      patientId: 'patient',
      pendingRedeemerUserId: 'contact',
    };
    expect(() =>
      assertFamilyTransitionActor({ ...base, action: 'decline' }),
    ).not.toThrow();
    expect(() =>
      assertFamilyTransitionActor({
        ...base,
        action: 'pause',
        familyUserId: 'contact',
      }),
    ).toThrow('FAMILY_OWNER_ONLY');
    expect(() =>
      assertFamilyTransitionActor({
        ...base,
        actorId: 'other',
        action: 'revoke',
      }),
    ).toThrow('FAMILY_LINK_FORBIDDEN');
  });

  it('normalizes exact lookup and moves delivery out of patient quiet hours', () => {
    expect(normalizeExactLookup('  CONTACT@EXAMPLE.TEST ')).toBe(
      'contact@example.test',
    );
    const daytime = new Date('2026-11-23T10:00:00.000Z');
    expect(nextQuietHoursTime(daytime, 'UTC')).toEqual(daytime);
    const night = new Date('2026-11-23T22:00:00.000Z');
    expect(nextQuietHoursTime(night, 'UTC').getUTCHours()).toBe(8);
    expect(nextQuietHoursTime(night, 'UTC').getUTCDate()).toBe(24);
  });
});
