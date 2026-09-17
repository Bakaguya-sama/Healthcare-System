import { Injectable } from '@nestjs/common';
import { CachePort } from '../../common/cache/cache.port';

export const PRACTITIONER_DIRECTORY_CACHE_POLICY = {
  key: 'v1:practitioners:directory',
  ttlMs: 60_000,
  owner: 'UsersCacheService',
} as const;

@Injectable()
export class UsersCacheService {
  constructor(private readonly cache: CachePort) {}

  getPractitionerDirectory<T>(loader: () => Promise<T>): Promise<T> {
    return this.cache.getOrSet(
      PRACTITIONER_DIRECTORY_CACHE_POLICY.key,
      PRACTITIONER_DIRECTORY_CACHE_POLICY.ttlMs,
      loader,
    );
  }

  invalidatePractitionerDirectory(): Promise<void> {
    return this.cache.delete(PRACTITIONER_DIRECTORY_CACHE_POLICY.key);
  }
}
