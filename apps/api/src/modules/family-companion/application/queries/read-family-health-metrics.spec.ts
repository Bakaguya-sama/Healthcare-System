import { ReadFamilyHealthMetrics } from './read-family-health-metrics';

describe('shared health metric authorization', () => {
  const owner = '507f1f77bcf86cd799439010';
  const contact = '507f1f77bcf86cd799439011';
  const linkId = '507f1f77bcf86cd799439012';
  const link = {
    patientId: owner,
    familyUserId: contact,
    status: 'active',
    invitationVersion: 1,
  };
  const grant = {
    familyUserId: contact,
    revision: 1,
    scope: { scope: 'selected' as const, metricTypes: ['weight'] },
    consentVersion: 'v1',
    consentedAt: new Date(),
  };
  const args = { metricType: 'weight', limit: 20 };

  function setup() {
    const repo = {
      getParticipantLink: jest.fn().mockResolvedValue(link),
      getActiveSharing: jest.fn().mockResolvedValue(grant),
      auditRead: jest.fn().mockResolvedValue(undefined),
    };
    const metrics = {
      supportedTypes: () => ['weight', 'heart_rate'],
      trend: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
      summary: jest.fn(),
    };
    const subscriptions = {
      getEffectiveSubscription: jest
        .fn()
        .mockResolvedValue({ planSnapshot: { familyLinkLimit: 1 } }),
    };
    const service = new ReadFamilyHealthMetrics(
      repo as never,
      metrics as never,
      subscriptions as never,
      { get: () => true } as never,
    );
    return { repo, metrics, service };
  }
  it('resolves patient from the link and rechecks permission before returning', async () => {
    const { repo, metrics, service } = setup();
    await service.read(contact, linkId, 'trend', args);
    expect(metrics.trend).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: owner }),
    );
    expect(repo.getParticipantLink).toHaveBeenCalledTimes(3);
    expect(repo.auditRead).toHaveBeenCalledWith(
      contact,
      owner,
      linkId,
      'family_health_metric_trend_read',
    );
  });
  it('rejects wrong actor, unshared metric, paused link and concurrent revocation', async () => {
    const { repo, metrics, service } = setup();
    await expect(service.read(owner, linkId, 'trend', args)).rejects.toThrow(
      'FAMILY_HEALTH_ACCESS_DENIED',
    );
    await expect(
      service.read(contact, linkId, 'trend', {
        ...args,
        metricType: 'heart_rate',
      }),
    ).rejects.toThrow('FAMILY_HEALTH_ACCESS_DENIED');
    repo.getParticipantLink.mockResolvedValueOnce({
      ...link,
      status: 'paused',
    });
    await expect(service.read(contact, linkId, 'trend', args)).rejects.toThrow(
      'FAMILY_HEALTH_ACCESS_DENIED',
    );
    repo.getActiveSharing
      .mockResolvedValueOnce(grant)
      .mockResolvedValueOnce(null);
    await expect(service.read(contact, linkId, 'trend', args)).rejects.toThrow(
      'FAMILY_HEALTH_ACCESS_DENIED',
    );
    expect(metrics.trend).toHaveBeenCalledTimes(1);
    expect(repo.auditRead).not.toHaveBeenCalled();
  });
});
