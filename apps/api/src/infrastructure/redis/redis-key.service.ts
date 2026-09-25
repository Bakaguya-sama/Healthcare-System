import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type RedisDataClass =
  | 'otp'
  | 'throttle'
  | 'presence'
  | 'quota'
  | 'cache'
  | 'queue';

@Injectable()
export class RedisKeyService {
  private readonly namespace: string;

  constructor(config: ConfigService) {
    this.namespace = config.getOrThrow<string>('REDIS_NAMESPACE');
  }

  build(dataClass: RedisDataClass, ...segments: string[]): string {
    const normalized = segments.map((segment) => {
      const value = segment.trim();
      if (!value) throw new Error('Redis key segments must be non-empty');
      return encodeURIComponent(value);
    });
    return [this.namespace, dataClass, ...normalized].join(':');
  }
}
