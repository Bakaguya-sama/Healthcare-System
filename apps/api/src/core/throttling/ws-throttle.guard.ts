import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { RedisThrottlerStorage } from '../../infrastructure/redis/redis-throttler.storage';
import {
  WS_THROTTLE_METADATA,
  WsThrottlePolicy,
} from './ws-throttle.decorator';

@Injectable()
export class WsThrottleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly storage: RedisThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.config.getOrThrow<boolean>('THROTTLE_ENABLED')) return true;

    const policy = this.reflector.getAllAndOverride<WsThrottlePolicy>(
      WS_THROTTLE_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!policy) return true;

    const client = context
      .switchToWs()
      .getClient<Socket & { userId?: string }>();
    const limit =
      policy.limit ?? this.config.getOrThrow<number>('WS_THROTTLE_LIMIT');
    const ttlMs =
      policy.ttlMs ?? this.config.getOrThrow<number>('WS_THROTTLE_TTL_MS');
    const tracker = client.userId ?? client.handshake.address ?? client.id;
    const result = await this.storage.incrementSocket(
      tracker,
      context.getHandler().name,
      ttlMs,
      limit,
    );
    if (result.isBlocked) throw new WsException('Too many socket events');
    return true;
  }
}
