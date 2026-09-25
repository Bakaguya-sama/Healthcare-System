import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { WsThrottleGuard } from './ws-throttle.guard';
import { WS_THROTTLE_METADATA } from './ws-throttle.decorator';
import { RedisThrottlerStorage } from '../../infrastructure/redis/redis-throttler.storage';

describe('WsThrottleGuard', () => {
  it('rejects events above the configured per-socket window', async () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === WS_THROTTLE_METADATA ? {} : undefined,
      ),
    } as unknown as Reflector;
    const config = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'THROTTLE_ENABLED') return true;
        return key === 'WS_THROTTLE_LIMIT' ? 2 : 10_000;
      }),
    } as unknown as ConfigService;
    const client = {
      id: 'socket-1',
      userId: 'user-1',
      handshake: { address: '127.0.0.1' },
    };
    const context = {
      getHandler: () => function sendMessage() {},
      getClass: () => class ChatGateway {},
      switchToWs: () => ({ getClient: () => client }),
    } as unknown as ExecutionContext;
    const storage = {
      incrementSocket: jest
        .fn()
        .mockResolvedValueOnce({ isBlocked: false })
        .mockResolvedValueOnce({ isBlocked: false })
        .mockResolvedValueOnce({ isBlocked: true }),
    } as unknown as RedisThrottlerStorage;
    const guard = new WsThrottleGuard(reflector, config, storage);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Too many socket events',
    );
  });

  it('bypasses event counting when throttling is disabled', async () => {
    const getAllAndOverride = jest.fn(() => ({}));
    const reflector = {
      getAllAndOverride,
    } as unknown as Reflector;
    const config = {
      getOrThrow: jest.fn(() => false),
    } as unknown as ConfigService;
    const context = {} as ExecutionContext;
    const incrementSocket = jest.fn();
    const storage = {
      incrementSocket,
    } as unknown as RedisThrottlerStorage;

    await expect(
      new WsThrottleGuard(reflector, config, storage).canActivate(context),
    ).resolves.toBe(true);
    expect(getAllAndOverride).not.toHaveBeenCalled();
    expect(incrementSocket).not.toHaveBeenCalled();
  });
});
