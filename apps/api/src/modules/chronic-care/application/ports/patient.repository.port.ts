export const PATIENT_REPOSITORY_PORT = Symbol('PATIENT_REPOSITORY_PORT');

export interface PatientRepositoryPort {
  isActive(id: string): Promise<boolean>;
}
