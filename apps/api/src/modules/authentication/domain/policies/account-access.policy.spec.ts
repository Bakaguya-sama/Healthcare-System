import { AccountStatus, DoctorVerificationStatus, UserRole } from '../../../../core/domain/user.enums';
import { mayReceiveFullAccess } from './account-access.policy';

describe('account access policy', () => {
  it('fails closed before email verification', () => expect(mayReceiveFullAccess({ accountStatus: AccountStatus.PENDING_VERIFICATION, role: UserRole.PATIENT })).toBe(false));
  it('requires separate doctor approval after verification', () => expect(mayReceiveFullAccess({ accountStatus: AccountStatus.ACTIVE, role: UserRole.DOCTOR, doctorVerificationStatus: DoctorVerificationStatus.PENDING })).toBe(false));
  it('allows an active approved doctor', () => expect(mayReceiveFullAccess({ accountStatus: AccountStatus.ACTIVE, role: UserRole.DOCTOR, doctorVerificationStatus: DoctorVerificationStatus.APPROVED })).toBe(true));
});
