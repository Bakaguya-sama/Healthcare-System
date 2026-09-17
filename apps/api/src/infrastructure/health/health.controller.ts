import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { RedisHealthIndicator } from './redis-health.indicator';

@Controller('health')
@ApiTags('Health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicator: HealthIndicatorService,
    private readonly mongo: MongooseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Check whether the API process is alive' })
  live() {
    return this.health.check([() => this.indicator.check('api').up()]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Check required MongoDB and Redis dependencies' })
  ready() {
    return this.health.check([
      () => this.mongo.pingCheck('mongodb', { timeout: 1_500 }),
      () => this.redis.check(),
    ]);
  }
}
