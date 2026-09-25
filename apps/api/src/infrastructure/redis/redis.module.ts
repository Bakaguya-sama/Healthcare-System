import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisKeyService } from './redis-key.service';
import { RedisService } from './redis.service';
import { RedisThrottlerStorage } from './redis-throttler.storage';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger(RedisService.name);
        const client = createClient({
          url: config.getOrThrow<string>('REDIS_URL'),
          socket: {
            connectTimeout: config.getOrThrow<number>(
              'REDIS_CONNECT_TIMEOUT_MS',
            ),
            reconnectStrategy: (retries) =>
              Math.min(100 * 2 ** Math.min(retries, 5), 3_000),
          },
        });
        client.on('error', (error: Error) =>
          logger.error({ event: 'redis_client_error', error }),
        );
        return client;
      },
    },
    RedisService,
    RedisKeyService,
    RedisThrottlerStorage,
  ],
  exports: [REDIS_CLIENT, RedisService, RedisKeyService, RedisThrottlerStorage],
})
export class RedisModule {}
