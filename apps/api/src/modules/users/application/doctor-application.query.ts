import { DoctorVerificationStatus } from '../../../core/domain/user.enums';

export interface DoctorApplicationQuery {
  page: number;
  limit: number;
  status?: DoctorVerificationStatus;
  search?: string;
  sortOrder?: 'asc' | 'desc';
}
