export const CARE_PROGRAM_ACCESS_PORT = Symbol('CARE_PROGRAM_ACCESS_PORT');
export type CareProgramAccessRequest = {
  patientId: string;
  programCode: string;
  activeProgramCount: number;
};

export type CareEntitlement =
  | { eligible: true; activeCareProgramLimit: number }
  | { eligible: false; reasonCode: string };

export interface CareProgramAccessPort {
  check(input: CareProgramAccessRequest): Promise<CareEntitlement>;
}
