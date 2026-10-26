import { Inject, Injectable } from '@nestjs/common';
import {
  BILLING_CARE_PROGRAM_ACCESS,
  type BillingCareProgramAccessPort,
} from '../../../billing/public-api';
import type {
  CareEntitlement,
  CareProgramAccessPort,
  CareProgramAccessRequest,
} from '../../application/ports/care-program-access.port';

/** Translates the Billing public contract without exposing Billing persistence. */
@Injectable()
export class BillingCareProgramAccessAdapter implements CareProgramAccessPort {
  constructor(
    @Inject(BILLING_CARE_PROGRAM_ACCESS)
    private readonly billing: BillingCareProgramAccessPort,
  ) {}

  async check(input: CareProgramAccessRequest): Promise<CareEntitlement> {
    // programCode originates from the published Program snapshot. Billing does
    // not grant by code; all limits come from the immutable subscription data.
    return this.billing.checkCareProgramAccess({
      patientId: input.patientId,
      activeProgramCount: input.activeProgramCount,
    });
  }
}
