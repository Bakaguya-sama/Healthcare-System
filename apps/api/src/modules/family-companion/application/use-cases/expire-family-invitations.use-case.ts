import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FAMILY_LINK_REPOSITORY,
  type FamilyLinkRepository,
} from '../ports/family-link.repository';
import { assertFamilyCompanionEnabled } from './family-companion-command-guard';

@Injectable()
export class ExpireFamilyInvitations {
  constructor(
    @Inject(FAMILY_LINK_REPOSITORY)
    private readonly invitations: FamilyLinkRepository,
    private readonly config: ConfigService,
  ) {}

  execute(now = new Date()) {
    if (this.config.get<boolean>('FAMILY_COMPANION_ENABLED') !== true) return 0;
    assertFamilyCompanionEnabled(this.config);
    return this.invitations.expirePendingInvitations(now);
  }
}
