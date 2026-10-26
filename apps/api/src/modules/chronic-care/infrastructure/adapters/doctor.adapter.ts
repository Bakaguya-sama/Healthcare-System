import { Injectable } from '@nestjs/common';
import {
  AccountStatus,
  DoctorVerificationStatus,
  UserRole,
} from '../../../../core/domain/user.enums';
import { UsersService } from '../../../users/public-api';
import { DoctorRepositoryPort } from '../../application/ports/doctor.repository.port';

@Injectable()
export class UsersDoctorAdapter implements DoctorRepositoryPort {
  constructor(private readonly users: UsersService) {}

  async isActiveAndApproved(id: string): Promise<boolean> {
    try {
      const user = await this.users.findById(id);
      return (
        user.role === UserRole.DOCTOR &&
        user.accountStatus === AccountStatus.ACTIVE &&
        user.doctorProfile?.verificationStatus ===
          DoctorVerificationStatus.APPROVED
      );
    } catch {
      return false;
    }
  }
}
