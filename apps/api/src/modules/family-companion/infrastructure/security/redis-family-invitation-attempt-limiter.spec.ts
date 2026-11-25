import { RedisFamilyInvitationAttemptLimiter } from './redis-family-invitation-attempt-limiter';

describe('family invitation short code limiter', () => {
  it('counts attempts by hashed actor in shared storage, independent of HTTP throttle', async () => {
    const storage = {
      increment: jest.fn().mockResolvedValue({ isBlocked: false }),
    };
    const limiter = new RedisFamilyInvitationAttemptLimiter(storage as never);
    await limiter.assertCanTryShortCode('patient-123');
    expect(storage.increment).toHaveBeenCalledWith(
      expect.not.stringContaining('patient-123'),
      900_000,
      5,
      900_000,
      'family-invitation-code',
    );
  });

  it('fails closed when Redis blocks or is unavailable', async () => {
    const storage = {
      increment: jest
        .fn()
        .mockResolvedValueOnce({ isBlocked: true })
        .mockRejectedValueOnce(new Error('offline')),
    };
    const limiter = new RedisFamilyInvitationAttemptLimiter(storage as never);
    await expect(limiter.assertCanTryShortCode('actor')).rejects.toMatchObject({
      status: 429,
    });
    await expect(limiter.assertCanTryShortCode('actor')).rejects.toMatchObject({
      status: 503,
    });
  });
});
