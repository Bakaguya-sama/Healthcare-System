import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import {
  CARE_DIRECTORY_QUERY_REPOSITORY,
  type CareDirectoryQueryRepository,
} from '../ports/care-directory.ports';

@Injectable()
export class ListMedicalSpecialties {
  constructor(
    @Inject(CARE_DIRECTORY_QUERY_REPOSITORY)
    private readonly directory: CareDirectoryQueryRepository,
    private readonly config: ConfigService,
  ) {}
  async execute() {
    this.assertEnabled();
    return { data: await this.directory.listActiveSpecialties() };
  }
  private assertEnabled() {
    if (!this.config.get<boolean>('FACILITY_DIRECTORY_ENABLED', false))
      throw new ServiceUnavailableException('FACILITY_DIRECTORY_DISABLED');
  }
}
