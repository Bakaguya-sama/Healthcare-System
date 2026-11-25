import { FamilyInvitation } from './family-link.entity';

describe('FamilyInvitation domain', () => {
  const now = new Date('2026-11-23T10:00:00.000Z');

  it('issues a direct invitation only when an internal contact was resolved', () => {
    const invitation = FamilyInvitation.issue({
      patientId: 'patient-1',
      familyUserId: 'contact-1',
      relationship: ' Người chăm sóc ',
      now,
      invitationDays: 7,
      shortCodeMinutes: 15,
    });
    expect(invitation.invitationDelivery).toBe('selected_contact');
    expect(invitation.relationship).toBe('Người chăm sóc');
    expect(invitation.invitationExpiresAt.toISOString()).toBe(
      '2026-11-30T10:00:00.000Z',
    );
    expect(invitation.shortCodeExpiresAt.toISOString()).toBe(
      '2026-11-23T10:15:00.000Z',
    );
  });

  it('issues a share invitation without a resolved contact', () => {
    expect(
      FamilyInvitation.issue({
        patientId: 'patient-1',
        now,
        invitationDays: 7,
        shortCodeMinutes: 15,
      }).invitationDelivery,
    ).toBe('shared_link');
  });
});
