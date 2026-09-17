import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createKeyvNonBlocking } from '@keyv/redis';
import { createCache } from 'cache-manager';
import { CacheManagerAdapter } from './cache-manager.adapter';
import { CachePort } from './cache.port';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: CacheManagerAdapter,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new CacheManagerAdapter(
          createCache({
            stores: [
              createKeyvNonBlocking(
                config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:16379',
                { namespace: 'healthcare-api' },
              ),
            ],
          }),
        ),
    },
    { provide: CachePort, useExisting: CacheManagerAdapter },
  ],
  exports: [CachePort, CacheManagerAdapter],
})
export class CacheModule {}
