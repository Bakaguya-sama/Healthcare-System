export type CacheMetricsSnapshot = {
  hits: number;
  misses: number;
  errors: number;
  writes: number;
  invalidations: number;
  loaderCalls: number;
  coalescedCalls: number;
  hitRate: number;
  averageOperationLatencyMs: number;
};

export abstract class CachePort {
  abstract get<T>(key: string): Promise<T | undefined>;
  abstract set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract getOrSet<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>,
  ): Promise<T>;
  abstract getMetrics(): CacheMetricsSnapshot;
}
