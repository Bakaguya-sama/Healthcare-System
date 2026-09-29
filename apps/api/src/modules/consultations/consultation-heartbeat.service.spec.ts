import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisKeyService } from '../../infrastructure/redis/redis-key.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { ConsultationHeartbeatService } from './consultation-heartbeat.service';
import { ConsultationsService } from './consultations.service';
import { ConsultationSessionStatus } from './entities/consultation.entity';

describe('ConsultationHeartbeatService', () => {
  const set = jest.fn();
  const redis = {
    client: { set },
    run: jest.fn((operation: Promise<unknown>) => operation),
  } as unknown as RedisService;
  const redisKeys = {
    build: jest.fn((...parts: string[]) => parts.join(':')),
  } as unknown as RedisKeyService;
  const consultations = {
    findAccessible: jest.fn(),
  } as unknown as ConsultationsService;
  const config = {
    getOrThrow: jest.fn(() => 90),
  } as unknown as ConfigService;

  let service: ConsultationHeartbeatService;

  beforeEach(() => {
    jest.clearAllMocks();
    set.mockResolvedValue('OK');
    service = new ConsultationHeartbeatService(
      redis,
      redisKeys,
      consultations,
      config,
    );
  });

  it('stores an authorized in-progress heartbeat in Redis with TTL', async () => {
    jest
      .mocked(consultations.findAccessible)
      .mockResolvedValue({
        sessionStatus: ConsultationSessionStatus.IN_PROGRESS,
      } as never);

    const result = await service.record('consultation-1', 'user-1');

    expect(redisKeys.build).toHaveBeenCalledWith(
      'consultation',
      'heartbeat',
      'consultation-1',
      'user-1',
    );
    expect(set).toHaveBeenCalledWith(
      'consultation:heartbeat:consultation-1:user-1',
      expect.any(String),
      { EX: 90 },
    );
    expect(result).toEqual({
      consultationId: 'consultation-1',
      recordedAt: expect.any(String),
      expiresAt: expect.any(String),
    });
  });

  it('rejects a user outside the consultation', async () => {
    jest.mocked(consultations.findAccessible).mockResolvedValue(null);

    await expect(service.record('consultation-1', 'user-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(set).not.toHaveBeenCalled();
  });

  it('rejects heartbeat outside an in-progress session', async () => {
    jest
      .mocked(consultations.findAccessible)
      .mockResolvedValue({
        sessionStatus: ConsultationSessionStatus.COMPLETED,
      } as never);

    await expect(service.record('consultation-1', 'user-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(set).not.toHaveBeenCalled();
  });
});
