import {
  AccountStatus,
  DoctorVerificationStatus,
  UserRole,
} from '../../../../core/domain/user.enums';

export type AccountAccessSnapshot = {
  accountStatus: AccountStatus;
  role: UserRole;
  doctorVerificationStatus?: DoctorVerificationStatus;
};

/** Domain policy: identity must be active before protected capabilities exist. */
export function mayReceiveFullAccess(account: AccountAccessSnapshot): boolean {
  if (account.accountStatus !== AccountStatus.ACTIVE) return false;
  return (
    account.role !== UserRole.DOCTOR ||
    account.doctorVerificationStatus === DoctorVerificationStatus.APPROVED
  );
}
