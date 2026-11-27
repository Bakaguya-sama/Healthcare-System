import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { createClient } from 'redis';
import { RedisKeyService } from '../src/infrastructure/redis/redis-key.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { RedisMapProviderRequestLimiter } from '../src/modules/care-directory/infrastructure/adapters/redis-map-provider-request-limiter';

describe('Google Maps provider distributed request limit', () => {
  const redisUrl = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:16379';
  const namespace = `e3-map-test-${randomUUID()}`;
  const actorId = '507f1f77bcf86cd799439011';
  const config = {
    getOrThrow: (key: string) => key === 'REDIS_COMMAND_TIMEOUT_MS' ? 3_000 : namespace,
    get: (key: string, fallback?: unknown) => key === 'GOOGLE_MAPS_REQUESTS_PER_MINUTE_PER_ACTOR' ? 1 : key === 'GOOGLE_MAPS_REQUESTS_PER_MINUTE_GLOBAL' ? 10 : fallback,
  } as never;
  let firstClient: ReturnType<typeof createClient>;
  let secondClient: ReturnType<typeof createClient>;
  let first: RedisMapProviderRequestLimiter;
  let second: RedisMapProviderRequestLimiter;
  let keys: RedisKeyService;

  beforeAll(async () => {
    firstClient = createClient({ url: redisUrl });
    secondClient = createClient({ url: redisUrl });
    await Promise.all([firstClient.connect(), secondClient.connect()]);
    keys = new RedisKeyService(config);
    first = new RedisMapProviderRequestLimiter(new RedisService(firstClient as never, config), keys, config);
    second = new RedisMapProviderRequestLimiter(new RedisService(secondClient as never, config), keys, config);
  });

  afterAll(async () => {
    if (!firstClient || !secondClient || !keys) return;
    const minute = Math.floor(Date.now() / 60_000).toString();
    const digest = createHash('sha256').update(actorId).digest('hex');
    await firstClient.del([keys.build('maps', 'actor', digest, minute), keys.build('maps', 'global', minute)]);
    await Promise.all([firstClient.quit(), secondClient.quit()]);
  });

  it('shares per-actor quota across two Redis-backed instances and fails closed on the next request', async () => {
    const outcomes = await Promise.allSettled([first.assertAllowed(actorId), second.assertAllowed(actorId)]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const denied = outcomes.find((result) => result.status === 'rejected');
    expect(denied).toMatchObject({ reason: expect.objectContaining({ message: 'MAP_PROVIDER_RATE_LIMITED' }) });
  });
});
