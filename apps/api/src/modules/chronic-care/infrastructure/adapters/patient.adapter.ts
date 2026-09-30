import { Injectable } from '@nestjs/common';
import { AccountStatus, UserRole } from '../../../../core/domain/user.enums';
import { UsersService } from '../../../users/public-api';
import type { PatientRepositoryPort } from '../../application/ports/patient.repository.port';
@Injectable()
export class UsersPatientAdapter implements PatientRepositoryPort {
  constructor(private readonly users: UsersService) {}
  async isActive(id: string): Promise<boolean> {
    try {
      const user = await this.users.findById(id);
      return (
        user.role === UserRole.PATIENT &&
        user.accountStatus === AccountStatus.ACTIVE
      );
    } catch {
      return false;
    }
  }
}
