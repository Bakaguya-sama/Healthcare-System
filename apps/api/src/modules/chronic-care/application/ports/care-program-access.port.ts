export const CARE_PROGRAM_ACCESS_PORT = Symbol('CARE_PROGRAM_ACCESS_PORT');
export type CareEntitlement = { eligible: boolean; reasonCode?: string };

export interface CareProgramAccessPort {
  check(patientId: string, programCode: string): Promise<CareEntitlement>;
}
