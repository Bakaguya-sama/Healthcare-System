import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import {
  WS_THROTTLE_METADATA,
  WsThrottlePolicy,
} from './ws-throttle.decorator';

type WindowCounter = { count: number; expiresAt: number };

@Injectable()
export class WsThrottleGuard implements CanActivate {
  private readonly counters = new Map<string, WindowCounter>();
  private attempts = 0;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
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
    const key = `${tracker}:${context.getHandler().name}`;
    const now = Date.now();
    const current = this.counters.get(key);

    if (!current || current.expiresAt <= now) {
      this.counters.set(key, { count: 1, expiresAt: now + ttlMs });
    } else {
      current.count += 1;
      if (current.count > limit) {
        throw new WsException('Too many socket events');
      }
    }

    this.attempts += 1;
    if (this.attempts % 1_000 === 0) this.prune(now);
    return true;
  }

  private prune(now: number): void {
    for (const [key, counter] of this.counters) {
      if (counter.expiresAt <= now) this.counters.delete(key);
    }
  }
}
