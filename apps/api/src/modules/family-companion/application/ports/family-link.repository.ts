import type { FamilyReminderPermission } from '../../domain/policies/family-companion.policy';

export const FAMILY_LINK_REPOSITORY = Symbol('FAMILY_LINK_REPOSITORY');

export type FamilyInvitationWorkflowResult = Record<string, unknown>;

export interface FamilyLinkRepository {
  findAcceptedInvitationReplay(
    userId: string,
    linkId: string,
    command: {
      consentVersion: string;
      permissions: FamilyReminderPermission[];
    },
    idempotencyKey: string,
  ): Promise<FamilyInvitationWorkflowResult | null>;
  findPendingInvitationOwner(
    userId: string,
    linkId: string,
  ): Promise<{ patientId: string; invitationVersion: number } | null>;
  redeemInvitation(
    userId: string,
    command: { invitationTokenHash?: string; shortCodeHash?: string },
    idempotencyKey: string,
  ): Promise<FamilyInvitationWorkflowResult>;
  acceptInvitation(
    userId: string,
    linkId: string,
    command: {
      consentVersion: string;
      permissions: FamilyReminderPermission[];
    },
    idempotencyKey: string,
    currentFamilyLinkLimit: number,
    invitationVersion: number,
  ): Promise<FamilyInvitationWorkflowResult>;
  rejectInvitation(
    userId: string,
    linkId: string,
    reason: string | undefined,
    idempotencyKey: string,
  ): Promise<FamilyInvitationWorkflowResult>;
  changeFamilyLinkStatus(
    userId: string,
    linkId: string,
    action: 'pause' | 'resume' | 'revoke',
    reason: string | undefined,
    idempotencyKey: string,
  ): Promise<FamilyInvitationWorkflowResult>;
  updatePermissions(
    userId: string,
    linkId: string,
    command: {
      permissions: FamilyReminderPermission[];
      policyVersion: string;
    },
    idempotencyKey: string,
  ): Promise<FamilyInvitationWorkflowResult>;
  regenerateArtifacts(
    userId: string,
    linkId: string,
    idempotencyKey: string,
    artifacts: {
      invitationTokenHash: string;
      shortCodeHash: string;
      shortCodeExpiresAt: Date;
      invitationExpiresAt: Date;
    },
  ): Promise<{
    result: {
      id: string;
      invitationVersion: number;
      shortCodeExpiresAt?: Date;
      invitationExpiresAt: Date;
    };
    replayed: boolean;
  }>;
  expirePendingInvitations(now?: Date): Promise<number>;
}
