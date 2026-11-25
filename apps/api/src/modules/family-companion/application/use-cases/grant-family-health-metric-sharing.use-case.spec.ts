import { GrantFamilyHealthMetricSharing } from './grant-family-health-metric-sharing.use-case';

describe('grant family health metric sharing', () => {
  const owner = '507f1f77bcf86cd799439012';
  const link = '507f1f77bcf86cd799439011';
  it('defaults to all and sends consent and actor to the transaction port', async () => {
    const sharing = { grant: jest.fn().mockResolvedValue({ revision: 1 }) };
    const service = new GrantFamilyHealthMetricSharing(
      sharing as never,
      { supportedTypes: () => ['weight'] } as never,
      { get: () => true } as never,
      {
        getEffectiveSubscription: async () => ({
          planSnapshot: { familyLinkLimit: 1 },
        }),
      } as never,
    );
    await service.execute(
      owner,
      link,
      { consentVersion: 'family-health-metric-sharing.v1' },
      'key',
    );
    expect(sharing.grant).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: owner,
        familyLinkId: link,
        scope: { scope: 'all' },
        idempotencyKey: 'key',
      }),
    );
  });
  it('rejects unsupported types and obsolete consent before persisting', async () => {
    const sharing = { grant: jest.fn() };
    const service = new GrantFamilyHealthMetricSharing(
      sharing as never,
      { supportedTypes: () => ['weight'] } as never,
      { get: () => true } as never,
      {
        getEffectiveSubscription: async () => ({
          planSnapshot: { familyLinkLimit: 1 },
        }),
      } as never,
    );
    await expect(
      service.execute(
        owner,
        link,
        {
          scope: 'selected',
          metricTypes: ['unknown'],
          consentVersion: 'family-health-metric-sharing.v1',
        },
        'key',
      ),
    ).rejects.toThrow('INVALID_METRIC_TYPES');
    await expect(
      service.execute(owner, link, { consentVersion: 'old' }, 'key'),
    ).rejects.toThrow('INVALID_HEALTH_METRIC_CONSENT_VERSION');
    expect(sharing.grant).not.toHaveBeenCalled();
  });
});
