import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { HealthModule } from '../src/infrastructure/health/health.module';
import { REDIS_CLIENT } from '../src/infrastructure/redis/redis.constants';
import { RedisModule } from '../src/infrastructure/redis/redis.module';
import { RedisThrottlerStorage } from '../src/infrastructure/redis/redis-throttler.storage';
import type { RedisClientType } from 'redis';

const mongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://localhost:27017/healthcare_rf4_health?replicaSet=rs0&directConnection=true';
const redisUrl = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:16379';

describe('RF-4 readiness and infrastructure lifecycle', () => {
  let app: INestApplication<App>;
  let redis: RedisClientType;
  let throttleStorage: RedisThrottlerStorage;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              MONGODB_URI: mongoUri,
              DB_AUTO_INDEX: false,
              DB_AUTO_CREATE: false,
              MONGO_SERVER_SELECTION_TIMEOUT_MS: 5_000,
              MIN_SCHEMA_VERSION: 0,
              REDIS_URL: redisUrl,
              REDIS_NAMESPACE: 'healthcare-test',
              REDIS_CONNECT_TIMEOUT_MS: 5_000,
              REDIS_COMMAND_TIMEOUT_MS: 1_500,
            }),
          ],
        }),
        DatabaseModule,
        RedisModule,
        HealthModule,
      ],
    }).compile();
    app = module.createNestApplication();
    redis = app.get<RedisClientType>(REDIS_CLIENT);
    throttleStorage = app.get(RedisThrottlerStorage);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    expect(redis.isOpen).toBe(false);
  });

  it('reports liveness without dependencies and readiness with MongoDB and Redis', async () => {
    await request(app.getHttpServer()).get('/health/live').expect(200);
    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200);

    expect(response.body as unknown).toMatchObject({
      status: 'ok',
      info: {
        mongodb: { status: 'up' },
        redis: { status: 'up' },
      },
    });
  });

  it('owns one connected Redis client that is closed with the application', () => {
    expect(redis.isReady).toBe(true);
  });

  it('stores throttle counters in shared Redis with an expiry', async () => {
    const tracker = `integration-${Date.now()}`;
    const first = await throttleStorage.incrementSocket(
      tracker,
      'sendMessage',
      10_000,
      2,
    );
    const second = await throttleStorage.incrementSocket(
      tracker,
      'sendMessage',
      10_000,
      2,
    );
    const blocked = await throttleStorage.incrementSocket(
      tracker,
      'sendMessage',
      10_000,
      2,
    );

    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    expect(blocked.isBlocked).toBe(true);
    expect(blocked.timeToExpire).toBeGreaterThan(0);
  });
});
