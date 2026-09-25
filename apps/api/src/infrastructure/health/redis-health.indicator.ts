import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly indicator: HealthIndicatorService,
    private readonly redis: RedisService,
  ) {}

  async check() {
    const indicator = this.indicator.check('redis');
    try {
      const response = await this.redis.ping();
      if (response !== 'PONG') throw new Error('Redis did not return PONG');
      return indicator.up();
    } catch (error: unknown) {
      return indicator.down(
        error instanceof Error ? error.message : 'Redis health check failed',
      );
    }
  }
}
