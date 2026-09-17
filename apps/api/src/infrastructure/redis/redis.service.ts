import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RedisClientType } from 'redis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(REDIS_CLIENT) readonly client: RedisClientType,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.client.isOpen) await this.client.connect();
  }

  async ping(): Promise<string> {
    return this.run(this.client.ping());
  }

  async run<T>(operation: Promise<T>): Promise<T> {
    const timeoutMs = this.config.getOrThrow<number>(
      'REDIS_COMMAND_TIMEOUT_MS',
    );
    return this.withTimeout(operation, timeoutMs);
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.client.isOpen) return;
    try {
      await this.client.quit();
    } catch (error: unknown) {
      this.logger.warn(`Redis graceful quit failed: ${String(error)}`);
      this.client.destroy();
    }
  }

  private async withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let handle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      handle = setTimeout(
        () => reject(new Error(`Redis command timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });
    try {
      return await Promise.race([operation, timeout]);
    } finally {
      if (handle) clearTimeout(handle);
    }
  }
}
