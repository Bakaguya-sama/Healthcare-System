import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FreeSubscriptionGrantService } from '../../../billing/public-api';
import {
  SHARED_HEALTH_METRIC,
  type SharedHealthMetricPort,
} from '../../../health-tracking/public-api';
import { mayReadSharedMetric } from '../../domain/policies/health-metric-sharing.policy';
import type {
  FamilyHealthMetricPeriod,
  HealthMetricTimeWindow,
} from '../../domain/policies/health-metric-period.policy';
import {
  HealthMetricPeriodError,
  resolveFamilyHealthMetricWindow,
} from '../../domain/policies/health-metric-period.policy';
import {
  FAMILY_HEALTH_METRIC_SHARING_REPOSITORY,
  type FamilyHealthMetricSharingRepository,
} from '../ports/family-health-metric-sharing.repository';
import {
  assertFamilyCompanionEnabled,
  assertValidFamilyId,
} from '../use-cases/family-companion-command-guard';

@Injectable()
export class ReadFamilyHealthMetrics {
  constructor(
    @Inject(FAMILY_HEALTH_METRIC_SHARING_REPOSITORY)
    private readonly sharing: FamilyHealthMetricSharingRepository,
    @Inject(SHARED_HEALTH_METRIC)
    private readonly metrics: SharedHealthMetricPort,
    private readonly subscriptions: FreeSubscriptionGrantService,
    private readonly config: ConfigService,
  ) {}

  async getSharing(actorId: string, familyLinkId: string) {
    assertFamilyCompanionEnabled(this.config);
    assertValidFamilyId(actorId);
    assertValidFamilyId(familyLinkId);
    const link = await this.sharing.getParticipantLink(actorId, familyLinkId);
    if (!link) throw new NotFoundException('FAMILY_LINK_NOT_FOUND');
    const grant = await this.sharing.getActiveSharing(
      familyLinkId,
      link.invitationVersion,
    );
    return {
      statusCode: 200,
      data: {
        linkStatus: link.status,
        sharing: grant
          ? {
              scope: grant.scope.scope,
              metricTypes:
                grant.scope.scope === 'selected' ? grant.scope.metricTypes : [],
              revision: grant.revision,
              consentVersion: grant.consentVersion,
              consentedAt: grant.consentedAt,
            }
          : null,
      },
    };
  }

  async read(
    actorId: string,
    familyLinkId: string,
    kind: 'summary' | 'trend',
    input: {
      metricType: string;
      period?: FamilyHealthMetricPeriod;
      anchor?: string;
      from?: string;
      to?: string;
      cursor?: string;
      limit: number;
    },
  ) {
    assertFamilyCompanionEnabled(this.config);
    assertValidFamilyId(actorId);
    assertValidFamilyId(familyLinkId);
    let window: HealthMetricTimeWindow;
    try {
      window = resolveFamilyHealthMetricWindow(input);
    } catch (error) {
      if (error instanceof HealthMetricPeriodError)
        throw new BadRequestException('INVALID_HEALTH_METRIC_PERIOD');
      throw error;
    }
    const access = await this.authorize(
      actorId,
      familyLinkId,
      input.metricType,
    );
    const data =
      kind === 'summary'
        ? await this.metrics.summary({
            patientId: access.patientId,
            metricType: input.metricType,
            from: window.from,
            to: window.to,
          })
        : await this.metrics.trend({
            patientId: access.patientId,
            metricType: input.metricType,
            from: window.from,
            to: window.to,
            cursor: input.cursor,
            limit: input.limit,
          });
    const rechecked = await this.authorize(
      actorId,
      familyLinkId,
      input.metricType,
    );
    if (
      rechecked.revision !== access.revision ||
      rechecked.invitationVersion !== access.invitationVersion
    )
      throw new ForbiddenException('FAMILY_HEALTH_SHARING_CHANGED');
    await this.sharing.auditRead(
      actorId,
      access.patientId,
      familyLinkId,
      `family_health_metric_${kind}_read`,
    );
    // These reads are separate operations; concurrent changes can interleave.
    // A single atomic authorization snapshot is required for linearizability.
    const finalCheck = await this.authorize(
      actorId,
      familyLinkId,
      input.metricType,
    );
    if (
      finalCheck.revision !== access.revision ||
      finalCheck.invitationVersion !== access.invitationVersion
    )
      throw new ForbiddenException('FAMILY_HEALTH_SHARING_CHANGED');
    return {
      statusCode: 200,
      data: {
        ...data,
        window: {
          period: window.period,
          ...(window.anchor ? { anchor: window.anchor } : {}),
          timeZone: window.timeZone,
          from: window.from?.toISOString() ?? null,
          to: window.to?.toISOString() ?? null,
          boundary: '[start,end)',
        },
      },
    };
  }

  private async authorize(actorId: string, linkId: string, metricType: string) {
    const link = await this.sharing.getParticipantLink(actorId, linkId);
    if (!link || link.familyUserId !== actorId || link.status !== 'active')
      throw new ForbiddenException('FAMILY_HEALTH_ACCESS_DENIED');
    const grant = await this.sharing.getActiveSharing(
      linkId,
      link.invitationVersion,
    );
    const subscription = await this.subscriptions.getEffectiveSubscription(
      link.patientId,
    );
    const limit = Number(subscription?.planSnapshot?.familyLinkLimit ?? 0);
    if (
      !grant ||
      grant.familyUserId !== actorId ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 10 ||
      !mayReadSharedMetric({
        linkStatus: 'active',
        invitationVersion: link.invitationVersion,
        grantedInvitationVersion: link.invitationVersion,
        sharingActive: true,
        scope: grant.scope,
        metricType,
        supportedTypes: this.metrics.supportedTypes(),
      })
    )
      throw new ForbiddenException('FAMILY_HEALTH_ACCESS_DENIED');
    return {
      patientId: link.patientId,
      invitationVersion: link.invitationVersion,
      revision: grant.revision,
    };
  }
}
