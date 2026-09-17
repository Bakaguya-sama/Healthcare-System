import { Injectable } from '@nestjs/common';
import { CachePort } from '../../common/cache/cache.port';

export const DOCTOR_DIRECTORY_CACHE_POLICY = {
  key: 'v1:doctors:directory',
  ttlMs: 60_000,
  owner: 'UsersCacheService',
} as const;

@Injectable()
export class UsersCacheService {
  constructor(private readonly cache: CachePort) {}

  getDoctorDirectory<T>(loader: () => Promise<T>): Promise<T> {
    return this.cache.getOrSet(
      DOCTOR_DIRECTORY_CACHE_POLICY.key,
      DOCTOR_DIRECTORY_CACHE_POLICY.ttlMs,
      loader,
    );
  }

  invalidateDoctorDirectory(): Promise<void> {
    return this.cache.delete(DOCTOR_DIRECTORY_CACHE_POLICY.key);
  }

}
