import type { UserRole } from '../../../../core/domain/user.enums';

export const CARE_IDENTITY_READER_PORT = Symbol('CARE_IDENTITY_READER_PORT');

export type CareIdentitySummary = {
  id: string;
  fullName: string;
  avatarUrl?: string;
  role: UserRole.PATIENT | UserRole.DOCTOR;
  specialty?: string;
};

/** Bounded identity projection; no Users document crosses into Chronic Care. */
export interface CareIdentityReaderPort {
  findSafeSummaries(ids: readonly string[]): Promise<CareIdentitySummary[]>;
}
