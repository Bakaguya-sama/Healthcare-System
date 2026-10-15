import type { PlanSnapshot } from '../entities/plan.entity';
import type { BillingCareProgramAccessDecision } from '../../application/ports/care-program-access.port';

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function isPlanSnapshot(value: unknown): value is PlanSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Record<string, unknown>;
  return (
    typeof snapshot.code === 'string' &&
    typeof snapshot.name === 'string' &&
    Number.isSafeInteger(snapshot.version) &&
    isNonNegativeInteger(snapshot.activeCareProgramLimit)
  );
}

export function decideCareProgramAccess(
  planSnapshot: unknown,
  activeProgramCount: number,
): BillingCareProgramAccessDecision {
  if (!isNonNegativeInteger(activeProgramCount))
    return { eligible: false, reasonCode: 'active_program_count_invalid' };
  if (!isPlanSnapshot(planSnapshot))
    return { eligible: false, reasonCode: 'subscription_snapshot_invalid' };
  if (activeProgramCount >= planSnapshot.activeCareProgramLimit)
    return { eligible: false, reasonCode: 'active_care_program_limit_reached' };
  return {
    eligible: true,
    activeCareProgramLimit: planSnapshot.activeCareProgramLimit,
  };
}
