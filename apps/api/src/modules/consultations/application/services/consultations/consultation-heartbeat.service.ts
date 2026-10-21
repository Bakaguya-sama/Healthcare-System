import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisKeyService } from '../../../../../infrastructure/redis/redis-key.service';
import { RedisService } from '../../../../../infrastructure/redis/redis.service';
import { ConsultationsService } from './consultations.service';
import { ConsultationSessionStatus } from '../../../domain/entities/consultations/consultation.entity';

@Injectable()
export class ConsultationHeartbeatService {
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    private readonly redisKeys: RedisKeyService,
    private readonly consultations: ConsultationsService,
    config: ConfigService,
  ) {
    this.ttlSeconds = config.getOrThrow<number>(
      'CONSULTATION_HEARTBEAT_TTL_SECONDS',
    );
  }

  async record(consultationId: string, userId: string) {
    const consultation = await this.consultations.findAccessible(
      consultationId,
      userId,
    );
    if (!consultation) {
      throw new ForbiddenException('Consultation is not accessible');
    }
    if (
      consultation.sessionStatus !==
      ConsultationSessionStatus.IN_CONSULTATION
    ) {
      throw new BadRequestException('Consultation is not in progress');
    }

    const recordedAt = new Date();
    await this.redis.run(
      this.redis.client.set(
        this.key(consultationId, userId),
        recordedAt.toISOString(),
        { EX: this.ttlSeconds },
      ),
    );

    return {
      consultationId,
      recordedAt: recordedAt.toISOString(),
      expiresAt: new Date(
        recordedAt.getTime() + this.ttlSeconds * 1_000,
      ).toISOString(),
    };
  }

  /**
   * A short-lived, authenticated waiting-room signal.  It deliberately does
   * not reuse the in-consultation heartbeat: before `start`, the latter would
   * falsely imply that a clinical session exists.
   */
  async recordWaitingRoomPresence(consultationId: string, userId: string) {
    const consultation = await this.consultations.findAccessible(
      consultationId,
      userId,
    );
    if (!consultation) throw new ForbiddenException('Consultation is not accessible');
    if (consultation.sessionStatus !== ConsultationSessionStatus.WAITING) {
      throw new BadRequestException('Consultation is not waiting');
    }
    const recordedAt = new Date();
    await this.redis.run(
      this.redis.client.set(this.waitingRoomKey(consultationId, userId), '1', {
        EX: this.ttlSeconds,
      }),
    );
    return { consultationId, recordedAt: recordedAt.toISOString() };
  }

  private key(consultationId: string, userId: string) {
    return this.redisKeys.build(
      'consultation',
      'heartbeat',
      consultationId,
      userId,
    );
  }

  private waitingRoomKey(consultationId: string, userId: string) {
    return this.redisKeys.build('consultation', 'waiting-room', consultationId, userId);
  }
}
