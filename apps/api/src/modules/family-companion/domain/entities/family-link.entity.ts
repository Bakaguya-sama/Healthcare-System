import type { FamilyLinkStatus } from '../policies/family-companion.policy';

export type FamilyInvitationDelivery = 'shared_link' | 'selected_contact';

export interface NewFamilyInvitation {
  patientId: string;
  familyUserId?: string;
  relationship?: string;
  invitationDelivery: FamilyInvitationDelivery;
  invitationVersion: number;
  invitedAt: Date;
  invitationExpiresAt: Date;
  shortCodeExpiresAt: Date;
}

/** Pure domain factory. Persistence, HTTP and token hashing stay outside domain. */
export class FamilyInvitation {
  static issue(input: {
    patientId: string;
    familyUserId?: string;
    relationship?: string;
    now: Date;
    invitationDays: number;
    shortCodeMinutes: number;
  }): NewFamilyInvitation {
    return {
      patientId: input.patientId,
      familyUserId: input.familyUserId,
      relationship: input.relationship?.trim() || undefined,
      invitationDelivery: input.familyUserId ? 'selected_contact' : 'shared_link',
      invitationVersion: 1,
      invitedAt: input.now,
      invitationExpiresAt: new Date(
        input.now.getTime() + input.invitationDays * 86_400_000,
      ),
      shortCodeExpiresAt: new Date(
        input.now.getTime() + input.shortCodeMinutes * 60_000,
      ),
    };
  }

  static assertCanRenew(status: FamilyLinkStatus) {
    if (!['declined', 'expired', 'revoked'].includes(status))
      throw new Error('FAMILY_INVITATION_NOT_RENEWABLE');
  }
}
