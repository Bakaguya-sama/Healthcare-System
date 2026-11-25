import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FreeSubscriptionGrantService } from '../../../billing/public-api';
import {
  SHARED_HEALTH_METRIC,
  type SharedHealthMetricPort,
} from '../../../health-tracking/public-api';
import {
  createHealthMetricSharingScope,
  HealthMetricSharingPolicyError,
} from '../../domain/policies/health-metric-sharing.policy';
import {
  FAMILY_HEALTH_METRIC_SHARING_REPOSITORY,
  type FamilyHealthMetricSharingRepository,
} from '../ports/family-health-metric-sharing.repository';
import {
  assertFamilyCompanionEnabled,
  assertFamilyIdempotencyKey,
  assertValidFamilyId,
} from './family-companion-command-guard';

export const FAMILY_HEALTH_METRIC_CONSENT_VERSION =
  'family-health-metric-sharing.v1';

@Injectable()
export class GrantFamilyHealthMetricSharing {
  constructor(
    @Inject(FAMILY_HEALTH_METRIC_SHARING_REPOSITORY)
    private readonly sharing: FamilyHealthMetricSharingRepository,
    @Inject(SHARED_HEALTH_METRIC)
    private readonly metrics: SharedHealthMetricPort,
    private readonly config: ConfigService,
    private readonly subscriptions: FreeSubscriptionGrantService,
  ) {}

  async execute(
    patientId: string,
    familyLinkId: string,
    input: { scope?: string; metricTypes?: string[]; consentVersion: string },
    idempotencyKey: string,
  ) {
    assertFamilyCompanionEnabled(this.config);
    assertValidFamilyId(patientId);
    assertValidFamilyId(familyLinkId);
    assertFamilyIdempotencyKey(idempotencyKey);
    if (input.consentVersion !== FAMILY_HEALTH_METRIC_CONSENT_VERSION)
      throw new BadRequestException('INVALID_HEALTH_METRIC_CONSENT_VERSION');
    try {
      const scope = createHealthMetricSharingScope(
        input.scope,
        input.metricTypes,
        this.metrics.supportedTypes(),
      );
      const subscription =
        await this.subscriptions.getEffectiveSubscription(patientId);
      const limit = Number(subscription?.planSnapshot?.familyLinkLimit ?? 0);
      if (!Number.isInteger(limit) || limit < 1 || limit > 10)
        throw new ForbiddenException('FAMILY_ENTITLEMENT_UNAVAILABLE');
      return this.sharing.grant({
        patientId,
        familyLinkId,
        scope,
        consentVersion: input.consentVersion,
        idempotencyKey: idempotencyKey.trim(),
        now: new Date(),
      });
    } catch (error) {
      if (error instanceof HealthMetricSharingPolicyError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }
}
