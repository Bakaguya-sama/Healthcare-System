export const GOOGLE_ACCOUNT_EMAIL_MAINTENANCE_PORT = Symbol(
  'GOOGLE_ACCOUNT_EMAIL_MAINTENANCE_PORT',
);

export interface GoogleEmailBackfillCandidate {
  userId: string;
}

export interface GoogleEmailConsistencyReport {
  orphanOAuthIdentities: number;
  oauthOnlyPatientsMissingIdentity: number;
  normalizedEmailCollisionGroups: number;
  providerVerificationMismatches: number;
}

/** Persistence boundary for the explicit Google account email maintenance use case. */
export interface GoogleAccountEmailMaintenancePort {
  listCandidates(
    afterUserId: string | undefined,
    limit: number,
  ): Promise<GoogleEmailBackfillCandidate[]>;
  findGoogleIdentityEmail(userId: string): Promise<string | null>;
  hasNormalizedEmailCollision(
    email: string,
    exceptUserId: string,
  ): Promise<boolean>;
  assignEmailIfStillMissing(userId: string, email: string): Promise<boolean>;
  verifyConsistency(): Promise<GoogleEmailConsistencyReport>;
}
