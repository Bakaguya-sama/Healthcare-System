export const DOCTOR_CAPABILITY_PORT = Symbol('DOCTOR_CAPABILITY_PORT');

/** Public capability requested from Users; no Users model crosses this boundary. */
export interface DoctorCapabilityPort {
  isActiveAndApproved(id: string): Promise<boolean>;
}
