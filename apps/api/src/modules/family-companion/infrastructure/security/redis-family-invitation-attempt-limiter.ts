import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { RedisThrottlerStorage } from '../../../../infrastructure/redis/redis-throttler.storage';
import type { FamilyInvitationAttemptLimiter } from '../../application/ports/family-invitation-attempt-limiter.port';

@Injectable()
export class RedisFamilyInvitationAttemptLimiter implements FamilyInvitationAttemptLimiter {
  constructor(private readonly storage: RedisThrottlerStorage) {}

  async assertCanTryShortCode(actorId: string): Promise<void> {
    const actorHash = createHash('sha256').update(actorId).digest('hex');
    let result: Awaited<ReturnType<RedisThrottlerStorage['increment']>>;
    try {
      result = await this.storage.increment(
        actorHash,
        15 * 60_000,
        5,
        15 * 60_000,
        'family-invitation-code',
      );
    } catch {
      // A missing distributed limiter must not silently allow code guessing.
      throw new ServiceUnavailableException('FAMILY_CODE_LIMITER_UNAVAILABLE');
    }
    if (result.isBlocked) {
      throw new HttpException(
        'FAMILY_CODE_ATTEMPTS_EXCEEDED',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
