import { Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { performance } from 'node:perf_hooks';
import { CacheMetricsSnapshot, CachePort } from './cache.port';

const CACHE_OPERATION_TIMEOUT_MS = 100;
const CACHE_WARNING_INTERVAL_MS = 30_000;

@Injectable()
export class CacheManagerAdapter extends CachePort {
  private readonly logger = new Logger(CacheManagerAdapter.name);
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly generations = new Map<string, number>();
  private hits = 0;
  private misses = 0;
  private errors = 0;
  private writes = 0;
  private invalidations = 0;
  private loaderCalls = 0;
  private coalescedCalls = 0;
  private operationCount = 0;
  private totalOperationLatencyMs = 0;
  private lastWarningAt = 0;

  constructor(private readonly cache: Cache) {
    super();
  }

  async get<T>(key: string): Promise<T | undefined> {
    const startedAt = performance.now();
    try {
      const value = await this.withTimeout(this.cache.get<T>(key));
      if (value === undefined || value === null) {
        this.misses += 1;
        return undefined;
      }

      this.hits += 1;
      return value;
    } catch (error: unknown) {
      this.errors += 1;
      this.misses += 1;
      this.warnUnavailable('get', error);
      return undefined;
    } finally {
      this.recordLatency(startedAt);
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const startedAt = performance.now();
    try {
      await this.withTimeout(this.cache.set(key, value, ttlMs));
      this.writes += 1;
    } catch (error: unknown) {
      this.errors += 1;
      this.warnUnavailable('set', error);
    } finally {
      this.recordLatency(startedAt);
    }
  }

  async delete(key: string): Promise<void> {
    this.generations.set(key, (this.generations.get(key) ?? 0) + 1);
    const startedAt = performance.now();
    try {
      await this.withTimeout(this.cache.del(key));
      this.invalidations += 1;
    } catch (error: unknown) {
      this.errors += 1;
      this.warnUnavailable('delete', error);
    } finally {
      this.recordLatency(startedAt);
    }
  }

  async getOrSet<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const activeLoad = this.inFlight.get(key) as Promise<T> | undefined;
    if (activeLoad) {
      this.coalescedCalls += 1;
      return activeLoad;
    }

    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;

    const loadStartedWhileReading = this.inFlight.get(key) as
      | Promise<T>
      | undefined;
    if (loadStartedWhileReading) {
      this.coalescedCalls += 1;
      return loadStartedWhileReading;
    }

    const generation = this.generations.get(key) ?? 0;
    const loadPromise = (async () => {
      this.loaderCalls += 1;
      const value = await loader();
      if ((this.generations.get(key) ?? 0) === generation) {
        await this.set(key, value, ttlMs);
      }
      return value;
    })();

    this.inFlight.set(key, loadPromise);
    try {
      return await loadPromise;
    } finally {
      if (this.inFlight.get(key) === loadPromise) {
        this.inFlight.delete(key);
      }
    }
  }

  getMetrics(): CacheMetricsSnapshot {
    const attempts = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      errors: this.errors,
      writes: this.writes,
      invalidations: this.invalidations,
      loaderCalls: this.loaderCalls,
      coalescedCalls: this.coalescedCalls,
      hitRate: attempts === 0 ? 0 : this.hits / attempts,
      averageOperationLatencyMs:
        this.operationCount === 0
          ? 0
          : this.totalOperationLatencyMs / this.operationCount,
    };
  }

  private async withTimeout<T>(operation: Promise<T>): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error('Cache operation timed out')),
        CACHE_OPERATION_TIMEOUT_MS,
      );
    });

    try {
      return await Promise.race([operation, timeout]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  private recordLatency(startedAt: number): void {
    this.operationCount += 1;
    this.totalOperationLatencyMs += performance.now() - startedAt;
  }

  private warnUnavailable(operation: string, error: unknown): void {
    const now = Date.now();
    if (now - this.lastWarningAt < CACHE_WARNING_INTERVAL_MS) return;
    this.lastWarningAt = now;
    this.logger.warn(
      `Cache ${operation} failed; falling back to the source query: ${String(error)}`,
    );
  }
}
