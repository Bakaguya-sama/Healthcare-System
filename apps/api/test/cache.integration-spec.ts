import { createKeyv } from '@keyv/redis';
import { createCache } from 'cache-manager';
import { randomUUID } from 'node:crypto';
import { CacheManagerAdapter } from '../src/common/cache/cache-manager.adapter';

const redisUrl = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:16379';

describe('RF-2E Redis cache adapter', () => {
  const redisStore = createKeyv(redisUrl, {
    namespace: `healthcare-rf2e-test-${randomUUID()}`,
  });
  const cache = createCache({ stores: [redisStore] });
  const adapter = new CacheManagerAdapter(cache);

  afterAll(async () => {
    await cache.clear();
    await cache.disconnect();
  });

  it('round-trips values, reports hits and invalidates explicitly', async () => {
    let sourceQueries = 0;
    const loader = () => {
      sourceQueries += 1;
      return Promise.resolve([{ id: `doctor-${sourceQueries}` }]);
    };

    const first = await adapter.getOrSet(
      'v1:doctors:directory',
      60_000,
      loader,
    );
    const second = await adapter.getOrSet(
      'v1:doctors:directory',
      60_000,
      loader,
    );
    await adapter.delete('v1:doctors:directory');
    const third = await adapter.getOrSet(
      'v1:doctors:directory',
      60_000,
      loader,
    );

    expect(first).toEqual(second);
    expect(third).not.toEqual(second);
    expect(sourceQueries).toBe(2);
    expect(adapter.getMetrics()).toMatchObject({
      hits: 1,
      misses: 2,
      invalidations: 1,
      loaderCalls: 2,
    });
  });
});
