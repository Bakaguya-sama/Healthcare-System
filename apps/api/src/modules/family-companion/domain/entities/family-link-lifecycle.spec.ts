import { transitionFamilyLink } from './family-link-lifecycle';

describe('FamilyLink lifecycle', () => {
  const patientId = 'patient-1';
  const contactId = 'contact-1';
  const now = new Date('2026-11-24T10:00:00.000Z');

  it('allows only the Patient owner to pause and records actor and time', () => {
    expect(
      transitionFamilyLink({
        link: { status: 'active', patientId, familyUserId: contactId },
        action: 'pause',
        actorId: patientId,
        now,
      }),
    ).toEqual({ status: 'paused', pausedAt: now, pausedBy: patientId });
    expect(() =>
      transitionFamilyLink({
        link: { status: 'active', patientId, familyUserId: contactId },
        action: 'pause',
        actorId: contactId,
        now,
      }),
    ).toThrow('FAMILY_OWNER_ONLY');
  });

  it('allows a pending redeemer to decline but not to manage the Patient link', () => {
    const pending = {
      status: 'pending' as const,
      patientId,
      pendingRedeemerUserId: contactId,
    };
    expect(
      transitionFamilyLink({
        link: pending,
        action: 'decline',
        actorId: contactId,
        reason: 'No thanks',
        now,
      }),
    ).toEqual({
      status: 'declined',
      declinedAt: now,
      declineReason: 'No thanks',
    });
    expect(() =>
      transitionFamilyLink({
        link: pending,
        action: 'revoke',
        actorId: contactId,
        now,
      }),
    ).toThrow('FAMILY_LINK_FORBIDDEN');
  });

  it('accepts a pending invitation only for its invited contact', () => {
    expect(
      transitionFamilyLink({
        link: {
          status: 'pending',
          patientId,
          pendingRedeemerUserId: contactId,
        },
        action: 'accept',
        actorId: contactId,
        now,
      }),
    ).toEqual({ status: 'active', acceptedAt: now });
    expect(() =>
      transitionFamilyLink({
        link: {
          status: 'pending',
          patientId,
          pendingRedeemerUserId: contactId,
        },
        action: 'accept',
        actorId: 'another-user',
        now,
      }),
    ).toThrow('FAMILY_LINK_FORBIDDEN');
  });
});
