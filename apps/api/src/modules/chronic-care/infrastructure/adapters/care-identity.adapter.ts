import { Injectable } from '@nestjs/common';
import { UsersService } from '../../../users/public-api';
import type {
  CareIdentityReaderPort,
  CareIdentitySummary,
} from '../../application/ports/care-identity-reader.port';

@Injectable()
export class UsersCareIdentityAdapter implements CareIdentityReaderPort {
  constructor(private readonly users: UsersService) {}

  findSafeSummaries(ids: readonly string[]): Promise<CareIdentitySummary[]> {
    return this.users.findCareIdentitySummaries(ids);
  }
}
