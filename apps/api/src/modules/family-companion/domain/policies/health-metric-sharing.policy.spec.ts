import {
  createHealthMetricSharingScope,
  mayReadSharedMetric,
} from './health-metric-sharing.policy';

describe('health metric sharing policy', () => {
  const types = ['weight', 'blood_pressure'];

  it('validates all and selected scopes against the owning catalog', () => {
    expect(createHealthMetricSharingScope('all', undefined, types)).toEqual({
      scope: 'all',
    });
    expect(createHealthMetricSharingScope(undefined, undefined, types)).toEqual(
      { scope: 'all' },
    );
    expect(
      createHealthMetricSharingScope('selected', ['weight'], types),
    ).toEqual({
      scope: 'selected',
      metricTypes: ['weight'],
    });
    expect(() => createHealthMetricSharingScope('all', [], types)).toThrow();
    expect(() =>
      createHealthMetricSharingScope('selected', [], types),
    ).toThrow();
    expect(() =>
      createHealthMetricSharingScope('selected', ['weight', 'weight'], types),
    ).toThrow();
    expect(() =>
      createHealthMetricSharingScope('selected', ['unknown'], types),
    ).toThrow();
  });

  it('checks link, invitation version, grant, scope and supported projection', () => {
    const input = {
      linkStatus: 'active' as const,
      invitationVersion: 2,
      grantedInvitationVersion: 2,
      sharingActive: true,
      scope: { scope: 'all' as const },
      metricType: 'weight',
      supportedTypes: types,
    };
    expect(mayReadSharedMetric(input)).toBe(true);
    expect(mayReadSharedMetric({ ...input, linkStatus: 'paused' })).toBe(false);
    expect(mayReadSharedMetric({ ...input, invitationVersion: 3 })).toBe(false);
    expect(mayReadSharedMetric({ ...input, sharingActive: false })).toBe(false);
    expect(
      mayReadSharedMetric({ ...input, metricType: 'new_unprojected_type' }),
    ).toBe(false);
    expect(
      mayReadSharedMetric({
        ...input,
        scope: { scope: 'selected', metricTypes: ['blood_pressure'] },
      }),
    ).toBe(false);
  });
});
