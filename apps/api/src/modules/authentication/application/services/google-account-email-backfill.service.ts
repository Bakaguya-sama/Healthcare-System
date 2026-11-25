import { Inject, Injectable } from '@nestjs/common';
import {
  GOOGLE_ACCOUNT_EMAIL_MAINTENANCE_PORT,
  type GoogleAccountEmailMaintenancePort,
} from '../ports/google-account-email-maintenance.port';
import { normalizeGoogleAccountEmail } from '../../domain/policies/google-account-email.policy';

export type GoogleEmailBackfillOptions = {
  apply: boolean;
  limit: number;
  after?: string;
};

/** Explicit maintenance use case; normal reads and logins never backfill data. */
@Injectable()
export class GoogleAccountEmailBackfillService {
  constructor(
    @Inject(GOOGLE_ACCOUNT_EMAIL_MAINTENANCE_PORT)
    private readonly maintenance: GoogleAccountEmailMaintenancePort,
  ) {}

  async execute(options: GoogleEmailBackfillOptions) {
    if (options.after && !/^[a-f\d]{24}$/i.test(options.after))
      throw new Error('Invalid Google email backfill cursor');
    const requestedLimit = Math.floor(options.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(500, requestedLimit || 100))
      : 100;
    const candidates = await this.maintenance.listCandidates(
      options.after,
      limit,
    );
    const counts = {
      scanned: candidates.length,
      eligible: 0,
      missingIdentityEmail: 0,
      invalidEmail: 0,
      collision: 0,
      applied: 0,
      changedDuringApply: 0,
    };

    for (const candidate of candidates) {
      const providerEmail = await this.maintenance.findGoogleIdentityEmail(
        candidate.userId,
      );
      if (!providerEmail?.trim()) {
        counts.missingIdentityEmail += 1;
        continue;
      }
      const email = normalizeGoogleAccountEmail(providerEmail);
      if (!email) {
        counts.invalidEmail += 1;
        continue;
      }
      if (
        await this.maintenance.hasNormalizedEmailCollision(
          email,
          candidate.userId,
        )
      ) {
        counts.collision += 1;
        continue;
      }
      counts.eligible += 1;
      if (!options.apply) continue;

      if (
        await this.maintenance.assignEmailIfStillMissing(
          candidate.userId,
          email,
        )
      )
        counts.applied += 1;
      else counts.changedDuringApply += 1;
    }

    return {
      mode: options.apply ? 'apply' : 'dry-run',
      ...counts,
      nextCursor: candidates.at(-1)?.userId ?? null,
      note: 'Email values are not verified by this command and are never returned.',
    };
  }

  verifyConsistency() {
    return this.maintenance.verifyConsistency();
  }
}
