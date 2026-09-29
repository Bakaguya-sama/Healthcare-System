export const DOCTOR_REPOSITORY_PORT = Symbol('DOCTOR_REPOSITORY_PORT');

/** Public capability requested from Users; no Users model crosses this boundary. */
export interface DoctorRepositoryPort {
  isActiveAndApproved(id: string): Promise<boolean>;
}
