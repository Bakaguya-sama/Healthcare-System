import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FAMILY_HEALTH_METRIC_SHARING_REPOSITORY,
  type FamilyHealthMetricSharingRepository,
} from '../ports/family-health-metric-sharing.repository';
import {
  assertFamilyCompanionEnabled,
  assertFamilyIdempotencyKey,
  assertValidFamilyId,
} from './family-companion-command-guard';

@Injectable()
export class RevokeFamilyHealthMetricSharing {
  constructor(
    @Inject(FAMILY_HEALTH_METRIC_SHARING_REPOSITORY)
    private readonly sharing: FamilyHealthMetricSharingRepository,
    private readonly config: ConfigService,
  ) {}
  execute(patientId: string, familyLinkId: string, idempotencyKey: string) {
    assertFamilyCompanionEnabled(this.config);
    assertValidFamilyId(patientId);
    assertValidFamilyId(familyLinkId);
    assertFamilyIdempotencyKey(idempotencyKey);
    return this.sharing.revoke({
      patientId,
      familyLinkId,
      idempotencyKey: idempotencyKey.trim(),
      now: new Date(),
    });
  }
}
