import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FAMILY_COMPANION_CONTACT_DIRECTORY } from '../ports/family-companion-contact-directory.port';
import type { FamilyCompanionContactDirectory } from '../ports/family-companion-contact-directory.port';

@Injectable()
export class SearchFamilyCompanionContacts {
  constructor(
    @Inject(FAMILY_COMPANION_CONTACT_DIRECTORY)
    private readonly contacts: FamilyCompanionContactDirectory,
    private readonly config: ConfigService,
  ) {}

  async execute(search: string, page = 1, limit = 20) {
    if (this.config.get<boolean>('FAMILY_COMPANION_ENABLED') !== true) {
      throw new ForbiddenException('FAMILY_COMPANION_DISABLED');
    }
    const normalizedSearch = search.trim();
    if (normalizedSearch.length < 2) {
      throw new BadRequestException('SEARCH_TERM_TOO_SHORT');
    }
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit = Number.isInteger(limit)
      ? Math.min(50, Math.max(1, limit))
      : 20;
    return {
      statusCode: 200,
      message: 'Eligible family contacts found',
      data: await this.contacts.searchEligiblePatients(
        normalizedSearch,
        safePage,
        safeLimit,
      ),
    };
  }
}
