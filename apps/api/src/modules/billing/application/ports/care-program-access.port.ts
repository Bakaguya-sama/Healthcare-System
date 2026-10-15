export const BILLING_CARE_PROGRAM_ACCESS = Symbol(
  'BILLING_CARE_PROGRAM_ACCESS',
);

export type BillingCareProgramAccessRequest = {
  patientId: string;
  activeProgramCount: number;
  checkedAt?: Date;
};

export type BillingCareProgramAccessDecision =
  | { eligible: true; activeCareProgramLimit: number }
  | { eligible: false; reasonCode: string };

/** Public Billing contract. It deliberately exposes no payment or pricing data. */
export interface BillingCareProgramAccessPort {
  checkCareProgramAccess(
    request: BillingCareProgramAccessRequest,
  ): Promise<BillingCareProgramAccessDecision>;
}
