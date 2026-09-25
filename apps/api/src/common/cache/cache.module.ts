import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createKeyvNonBlocking } from '@keyv/redis';
import { createCache } from 'cache-manager';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { CacheManagerAdapter } from './cache-manager.adapter';
import { CachePort } from './cache.port';

@Global()
@Module({
  imports: [ConfigModule, RedisModule],
  providers: [
    {
      provide: CacheManagerAdapter,
      inject: [ConfigService, RedisService],
      useFactory: (config: ConfigService, redis: RedisService) =>
        new CacheManagerAdapter(
          createCache({
            stores: [
              createKeyvNonBlocking(redis.client, {
                namespace: `${config.getOrThrow<string>('REDIS_NAMESPACE')}:cache`,
              }),
            ],
          }),
        ),
    },
    { provide: CachePort, useExisting: CacheManagerAdapter },
  ],
  exports: [CachePort, CacheManagerAdapter],
})
export class CacheModule {}
