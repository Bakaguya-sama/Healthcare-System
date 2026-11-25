import { GoogleAccountEmailBackfillService } from './google-account-email-backfill.service';

describe('GoogleAccountEmailBackfillService', () => {
  function setup(options: { collision?: boolean; applied?: boolean } = {}) {
    const maintenance = {
      listCandidates: jest.fn().mockResolvedValue([{ userId: 'user-1' }]),
      findGoogleIdentityEmail: jest
        .fn()
        .mockResolvedValue('  Historic@Example.com '),
      hasNormalizedEmailCollision: jest
        .fn()
        .mockResolvedValue(options.collision ?? false),
      assignEmailIfStillMissing: jest
        .fn()
        .mockResolvedValue(options.applied ?? true),
      verifyConsistency: jest.fn().mockResolvedValue({
        orphanOAuthIdentities: 0,
        oauthOnlyPatientsMissingIdentity: 0,
        normalizedEmailCollisionGroups: 0,
        providerVerificationMismatches: 0,
      }),
    };
    return {
      service: new GoogleAccountEmailBackfillService(maintenance),
      maintenance,
      email: 'historic@example.com',
    };
  }

  it('defaults to dry-run, normalizes the email, and returns no email value', async () => {
    const { service, maintenance, email } = setup();
    const result = await service.execute({ apply: false, limit: 100 });
    expect(result).toMatchObject({ mode: 'dry-run', scanned: 1, eligible: 1, applied: 0 });
    expect(JSON.stringify(result)).not.toContain(email);
    expect(maintenance.assignEmailIfStillMissing).not.toHaveBeenCalled();
    expect(maintenance.hasNormalizedEmailCollision).toHaveBeenCalledWith(email, 'user-1');
  });

  it('uses the persistence port to conditionally apply eligible records', async () => {
    const { service, maintenance, email } = setup();
    const result = await service.execute({ apply: true, limit: 100 });
    expect(result.applied).toBe(1);
    expect(maintenance.assignEmailIfStillMissing).toHaveBeenCalledWith('user-1', email);
  });

  it('skips collisions without attempting an update', async () => {
    const { service, maintenance } = setup({ collision: true });
    const result = await service.execute({ apply: true, limit: 100 });
    expect(result.collision).toBe(1);
    expect(result.applied).toBe(0);
    expect(maintenance.assignEmailIfStillMissing).not.toHaveBeenCalled();
  });

  it('does not mark malformed or missing provider emails as verified or assign them', async () => {
    const { service, maintenance } = setup();
    maintenance.findGoogleIdentityEmail.mockResolvedValueOnce('not-an-email');
    maintenance.findGoogleIdentityEmail.mockResolvedValueOnce(null);
    maintenance.listCandidates.mockResolvedValueOnce([
      { userId: 'bad-1' },
      { userId: 'missing-1' },
    ]);
    const result = await service.execute({ apply: true, limit: 2 });
    expect(result.invalidEmail).toBe(1);
    expect(result.missingIdentityEmail).toBe(1);
    expect(maintenance.assignEmailIfStillMissing).not.toHaveBeenCalled();
  });

  it('delegates the read-only consistency report', async () => {
    const { service, maintenance } = setup();
    await service.verifyConsistency();
    expect(maintenance.verifyConsistency).toHaveBeenCalledTimes(1);
  });
});
