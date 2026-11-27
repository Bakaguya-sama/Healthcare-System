import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { RedisKeyService } from '../../../../infrastructure/redis/redis-key.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import type { MapProviderRequestLimiter } from '../../application/ports/care-directory.ports';

const TAKE_REQUEST_SCRIPT = `
local actorCount = redis.call('INCR', KEYS[1])
if actorCount == 1 then redis.call('EXPIRE', KEYS[1], 70) end
if actorCount > tonumber(ARGV[1]) then return 0 end
local globalCount = redis.call('INCR', KEYS[2])
if globalCount == 1 then redis.call('EXPIRE', KEYS[2], 70) end
if globalCount > tonumber(ARGV[2]) then return 0 end
return 1
`;

@Injectable()
export class RedisMapProviderRequestLimiter implements MapProviderRequestLimiter {
  constructor(
    private readonly redis: RedisService,
    private readonly keys: RedisKeyService,
    private readonly config: ConfigService,
  ) {}

  async assertAllowed(actorId: string): Promise<void> {
    const minute = Math.floor(Date.now() / 60_000).toString();
    const actorDigest = createHash('sha256').update(actorId).digest('hex');
    let result: unknown;
    try {
      result = await this.redis.run(this.redis.client.eval(TAKE_REQUEST_SCRIPT, {
        keys: [
          this.keys.build('maps', 'actor', actorDigest, minute),
          this.keys.build('maps', 'global', minute),
        ],
        arguments: [
          String(this.config.get<number>('GOOGLE_MAPS_REQUESTS_PER_MINUTE_PER_ACTOR', 5)),
          String(this.config.get<number>('GOOGLE_MAPS_REQUESTS_PER_MINUTE_GLOBAL', 60)),
        ],
      }));
    } catch {
      throw new ServiceUnavailableException('MAP_PROVIDER_RATE_LIMIT_UNAVAILABLE');
    }
    if (Number(result) !== 1) throw new HttpException('MAP_PROVIDER_RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
  }
}
