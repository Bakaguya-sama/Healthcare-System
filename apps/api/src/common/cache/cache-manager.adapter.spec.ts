import type { Cache } from 'cache-manager';
import { CacheManagerAdapter } from './cache-manager.adapter';

function createMemoryCache(): Cache {
  const values = new Map<string, unknown>();
  return {
    get: jest.fn(<T>(key: string) =>
      Promise.resolve(values.get(key) as T | undefined),
    ),
    set: jest.fn(<T>(key: string, value: T) => {
      values.set(key, value);
      return Promise.resolve(value);
    }),
    del: jest.fn((key: string) => Promise.resolve(values.delete(key))),
  } as unknown as Cache;
}

describe('CacheManagerAdapter', () => {
  it('loads once, caches the value and records a hit', async () => {
    const cache = createMemoryCache();
    const adapter = new CacheManagerAdapter(cache);
    const loader = jest.fn().mockResolvedValue([{ id: 'doctor-1' }]);

    const first = await adapter.getOrSet('directory', 60_000, loader);
    const second = await adapter.getOrSet('directory', 60_000, loader);

    expect(first).toEqual(second);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(adapter.getMetrics()).toMatchObject({
      hits: 1,
      misses: 1,
      loaderCalls: 1,
      hitRate: 0.5,
    });
  });

  it('coalesces concurrent misses into one source query', async () => {
    const cache = createMemoryCache();
    const adapter = new CacheManagerAdapter(cache);
    const loader = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return ['doctor-1'];
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        adapter.getOrSet('directory', 60_000, loader),
      ),
    );

    expect(results).toHaveLength(10);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(adapter.getMetrics().coalescedCalls).toBeGreaterThan(0);
  });

  it('falls back to the loader when Redis is unavailable', async () => {
    const cache = {
      get: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
      set: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
      del: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
    } as unknown as Cache;
    const adapter = new CacheManagerAdapter(cache);

    await expect(
      adapter.getOrSet('directory', 60_000, () => Promise.resolve(['from-db'])),
    ).resolves.toEqual(['from-db']);
    await expect(adapter.delete('directory')).resolves.toBeUndefined();
    expect(adapter.getMetrics().errors).toBe(3);
  });

  it('does not repopulate a key invalidated during an in-flight load', async () => {
    let resolveLoader: ((value: string[]) => void) | undefined;
    let markLoaderStarted: (() => void) | undefined;
    const loaderStarted = new Promise<void>((resolve) => {
      markLoaderStarted = resolve;
    });
    const loaderResult = new Promise<string[]>((resolve) => {
      resolveLoader = resolve;
    });
    const cache = createMemoryCache();
    const adapter = new CacheManagerAdapter(cache);
    const loading = adapter.getOrSet('directory', 60_000, () => {
      markLoaderStarted?.();
      return loaderResult;
    });

    await loaderStarted;
    await adapter.delete('directory');
    resolveLoader?.(['stale-doctor']);
    await loading;

    expect(cache.set).not.toHaveBeenCalled();
  });
});
