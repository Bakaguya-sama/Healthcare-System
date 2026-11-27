import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import {
  CARE_DIRECTORY_QUERY_REPOSITORY,
  type CareDirectoryQueryRepository,
} from '../ports/care-directory.ports';

@Injectable()
export class GetMedicalFacility {
  constructor(
    @Inject(CARE_DIRECTORY_QUERY_REPOSITORY)
    private readonly directory: CareDirectoryQueryRepository,
    private readonly config: ConfigService,
  ) {}
  async execute(_patientId: string, id: string) {
    if (!this.config.get<boolean>('FACILITY_DIRECTORY_ENABLED', false))
      throw new ServiceUnavailableException('FACILITY_DIRECTORY_DISABLED');
    const facility = await this.directory.getVerifiedFacility(
      id,
      new Date(),
      this.config.get<number>('FACILITY_FRESHNESS_DAYS', 180),
    );
    if (!facility) throw new NotFoundException('VERIFIED_FACILITY_NOT_FOUND');
    return { data: facility };
  }
}
