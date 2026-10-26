import { Injectable } from '@nestjs/common';
import type {
  BillingCareProgramAccessDecision,
  BillingCareProgramAccessPort,
  BillingCareProgramAccessRequest,
} from '../ports/care-program-access.port';
import { decideCareProgramAccess } from '../../domain/policies/care-program-access.policy';
import { FreeSubscriptionGrantService } from './free-subscription-grant.service';

@Injectable()
export class SubscriptionCareProgramAccessService implements BillingCareProgramAccessPort {
  constructor(private readonly grants: FreeSubscriptionGrantService) {}

  async checkCareProgramAccess(
    request: BillingCareProgramAccessRequest,
  ): Promise<BillingCareProgramAccessDecision> {
    const subscription = await this.grants.getEffectiveSubscription(
      request.patientId,
      request.checkedAt,
    );
    if (!subscription)
      return { eligible: false, reasonCode: 'subscription_unavailable' };
    return decideCareProgramAccess(
      subscription.planSnapshot,
      request.activeProgramCount,
    );
  }
}
