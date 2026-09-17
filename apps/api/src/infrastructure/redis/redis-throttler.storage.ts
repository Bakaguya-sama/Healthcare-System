import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RedisKeyService } from './redis-key.service';
import { RedisService } from './redis.service';

const INCREMENT_SCRIPT = `
local blockedTtl = redis.call('PTTL', KEYS[2])
if blockedTtl > 0 then
  local current = tonumber(redis.call('GET', KEYS[1]) or '0')
  return { current, math.max(redis.call('PTTL', KEYS[1]), 0), 1, blockedTtl }
end

local total = redis.call('INCR', KEYS[1])
if total == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = math.max(redis.call('PTTL', KEYS[1]), 0)
if total > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return { total, ttl, 1, tonumber(ARGV[3]) }
end
return { total, ttl, 0, 0 }
`;

type ThrottleRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(
    private readonly redis: RedisService,
    private readonly keys: RedisKeyService,
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottleRecord> {
    const baseKey = this.keys.build('throttle', 'http', throttlerName, key);
    return this.incrementKeys(baseKey, ttl, limit, blockDuration || ttl);
  }

  async incrementSocket(
    tracker: string,
    handler: string,
    ttl: number,
    limit: number,
  ): Promise<ThrottleRecord> {
    const baseKey = this.keys.build('throttle', 'socket', tracker, handler);
    return this.incrementKeys(baseKey, ttl, limit, ttl);
  }

  private async incrementKeys(
    baseKey: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottleRecord> {
    const result = (await this.redis.run(
      this.redis.client.eval(INCREMENT_SCRIPT, {
        keys: [baseKey, `${baseKey}:blocked`],
        arguments: [String(ttl), String(limit), String(blockDuration)],
      }),
    )) as number[];
    return {
      totalHits: Number(result[0]),
      timeToExpire: Math.ceil(Number(result[1]) / 1_000),
      isBlocked: Number(result[2]) === 1,
      timeToBlockExpire: Math.ceil(Number(result[3]) / 1_000),
    };
  }
}
