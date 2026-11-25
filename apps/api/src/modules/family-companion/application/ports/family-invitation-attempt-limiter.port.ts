export const FAMILY_INVITATION_ATTEMPT_LIMITER = Symbol(
  'FAMILY_INVITATION_ATTEMPT_LIMITER',
);

export interface FamilyInvitationAttemptLimiter {
  assertCanTryShortCode(actorId: string): Promise<void>;
}
