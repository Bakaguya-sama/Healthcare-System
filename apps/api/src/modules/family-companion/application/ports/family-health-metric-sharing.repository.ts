import type { HealthMetricSharingScope } from '../../domain/policies/health-metric-sharing.policy';

export const FAMILY_HEALTH_METRIC_SHARING_REPOSITORY = Symbol(
  'FAMILY_HEALTH_METRIC_SHARING_REPOSITORY',
);

/** Implementations must perform link validation, consent revision, audit and outbox atomically. */
export interface FamilyHealthMetricSharingRepository {
  getParticipantLink(
    actorId: string,
    familyLinkId: string,
  ): Promise<{
    patientId: string;
    familyUserId?: string;
    status: string;
    invitationVersion: number;
  } | null>;
  getActiveSharing(
    familyLinkId: string,
    invitationVersion: number,
  ): Promise<{
    familyUserId: string;
    scope: HealthMetricSharingScope;
    revision: number;
    consentVersion: string;
    consentedAt: Date;
  } | null>;
  auditRead(
    actorId: string,
    patientId: string,
    familyLinkId: string,
    action: string,
  ): Promise<void>;
  grant(input: {
    patientId: string;
    familyLinkId: string;
    scope: HealthMetricSharingScope;
    consentVersion: string;
    idempotencyKey: string;
    now: Date;
  }): Promise<{ revision: number }>;
  revoke(input: {
    patientId: string;
    familyLinkId: string;
    idempotencyKey: string;
    now: Date;
  }): Promise<void>;
}
