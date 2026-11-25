import type { FamilyLinkStatus } from './family-companion.policy';

export type HealthMetricSharingScope =
  | { scope: 'all' }
  | { scope: 'selected'; metricTypes: string[] };

export class HealthMetricSharingPolicyError extends Error {}

/** The catalog is supplied by Health Tracking, the owner of metric types. */
export function createHealthMetricSharingScope(
  scope: unknown,
  metricTypes: unknown,
  supportedTypes: readonly string[],
): HealthMetricSharingScope {
  if (scope === undefined || scope === 'all') {
    if (metricTypes !== undefined)
      throw new HealthMetricSharingPolicyError(
        'METRIC_TYPES_NOT_ALLOWED_FOR_ALL',
      );
    return { scope: 'all' };
  }
  if (
    scope !== 'selected' ||
    !Array.isArray(metricTypes) ||
    !metricTypes.length
  )
    throw new HealthMetricSharingPolicyError('INVALID_METRIC_SCOPE');
  if (
    metricTypes.some(
      (type) => typeof type !== 'string' || !supportedTypes.includes(type),
    ) ||
    new Set(metricTypes).size !== metricTypes.length
  )
    throw new HealthMetricSharingPolicyError('INVALID_METRIC_TYPES');
  return { scope: 'selected', metricTypes: [...metricTypes] as string[] };
}

export function mayReadSharedMetric(input: {
  linkStatus: FamilyLinkStatus;
  invitationVersion: number;
  grantedInvitationVersion: number;
  sharingActive: boolean;
  scope: HealthMetricSharingScope;
  metricType: string;
  supportedTypes: readonly string[];
}): boolean {
  return (
    input.linkStatus === 'active' &&
    input.sharingActive &&
    input.invitationVersion === input.grantedInvitationVersion &&
    input.supportedTypes.includes(input.metricType) &&
    (input.scope.scope === 'all' ||
      input.scope.metricTypes.includes(input.metricType))
  );
}
