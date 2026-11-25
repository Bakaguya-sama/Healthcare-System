import { randomUUID, createHash } from 'node:crypto';
import { loadDatabaseEnvironment } from '../src/database/load-database-environment';
import { createClient } from 'redis';
import { RedisKeyService } from '../src/infrastructure/redis/redis-key.service';
import { RedisThrottlerStorage } from '../src/infrastructure/redis/redis-throttler.storage';
import { RedisFamilyInvitationAttemptLimiter } from '../src/modules/family-companion/infrastructure/security/redis-family-invitation-attempt-limiter';

describe('family invitation distributed attempt limiter', () => {
  it('shares an actor limit across adapter instances and rejects the sixth attempt', async () => {
    loadDatabaseEnvironment();
    if (!process.env.REDIS_URL)
      throw new Error('REDIS_URL_REQUIRED_FOR_INTEGRATION');
    const clientOptions = {
      url: process.env.REDIS_URL,
      socket: { connectTimeout: 5000, reconnectStrategy: false as const },
    };
    const firstClient = createClient(clientOptions);
    const secondClient = createClient(clientOptions);
    firstClient.on('error', () => undefined);
    secondClient.on('error', () => undefined);
    await Promise.all([firstClient.connect(), secondClient.connect()]);
    const actor = randomUUID();
    const namespace = `family_test_${randomUUID()}`;
    const keys = new RedisKeyService({ getOrThrow: () => namespace } as never);
    const firstRedis = {
      client: firstClient,
      run: <T>(operation: Promise<T>) => operation,
    };
    const secondRedis = {
      client: secondClient,
      run: <T>(operation: Promise<T>) => operation,
    };
    const first = new RedisFamilyInvitationAttemptLimiter(
      new RedisThrottlerStorage(firstRedis as never, keys),
    );
    const second = new RedisFamilyInvitationAttemptLimiter(
      new RedisThrottlerStorage(secondRedis as never, keys),
    );
    const key = keys.build(
      'throttle',
      'http',
      'family-invitation-code',
      createHash('sha256').update(actor).digest('hex'),
    );
    try {
      for (let attempt = 0; attempt < 5; attempt++)
        await first.assertCanTryShortCode(actor);
      await expect(second.assertCanTryShortCode(actor)).rejects.toMatchObject({
        status: 429,
      });
    } finally {
      await firstClient.del([key, `${key}:blocked`]);
      await Promise.all([firstClient.quit(), secondClient.quit()]);
    }
  }, 15_000);
});
