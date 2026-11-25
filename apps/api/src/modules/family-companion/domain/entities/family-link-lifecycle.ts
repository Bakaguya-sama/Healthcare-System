import {
  assertFamilyTransitionActor,
  assertTransition,
  type FamilyLinkStatus,
} from '../policies/family-companion.policy';

export type FamilyLinkTransitionAction =
  | 'accept'
  | 'decline'
  | 'pause'
  | 'resume'
  | 'revoke';

export interface FamilyLinkLifecycleState {
  status: FamilyLinkStatus;
  patientId: string;
  familyUserId?: string;
  pendingRedeemerUserId?: string;
}

export interface FamilyLinkTransitionResult {
  status: FamilyLinkStatus;
  acceptedAt?: Date;
  declinedAt?: Date;
  declineReason?: string;
  pausedAt?: Date;
  pausedBy?: string;
  resumedAt?: Date;
  resumedBy?: string;
  revokedAt?: Date;
  revokedBy?: string;
  revokeReason?: string;
}

/** Applies a permitted FamilyLink state change without persistence or transport concerns. */
export function transitionFamilyLink(input: {
  link: FamilyLinkLifecycleState;
  action: FamilyLinkTransitionAction;
  actorId: string;
  reason?: string;
  now: Date;
}): FamilyLinkTransitionResult {
  assertTransition(input.link.status, input.action);
  assertFamilyTransitionActor({
    action: input.action,
    actorId: input.actorId,
    patientId: input.link.patientId,
    familyUserId: input.link.familyUserId,
    pendingRedeemerUserId: input.link.pendingRedeemerUserId,
  });
  const reason = input.reason?.slice(0, 160);
  switch (input.action) {
    case 'accept':
      return { status: 'active', acceptedAt: input.now };
    case 'decline':
      return {
        status: 'declined',
        declinedAt: input.now,
        declineReason: reason,
      };
    case 'pause':
      return { status: 'paused', pausedAt: input.now, pausedBy: input.actorId };
    case 'resume':
      return {
        status: 'active',
        resumedAt: input.now,
        resumedBy: input.actorId,
      };
    case 'revoke':
      return {
        status: 'revoked',
        revokedAt: input.now,
        revokedBy: input.actorId,
        revokeReason: reason,
      };
  }
}
