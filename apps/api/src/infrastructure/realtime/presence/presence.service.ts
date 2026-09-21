import { Injectable } from '@nestjs/common';
import { RedisKeyService } from '../../redis/redis-key.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class PresenceService {
  private activeUsers = new Map<string, Set<string>>();

  private readonly ttlSeconds = 300;

  constructor(
    private readonly redis: RedisService,
    private readonly redisKeys: RedisKeyService,
  ) {}

  async addActiveUser(userId: string, socketId: string) {
    if (!this.activeUsers.has(userId)) {
      this.activeUsers.set(userId, new Set([socketId]));
      await this.persist(userId, socketId);
      return true;
    }

    this.activeUsers.get(userId)!.add(socketId);
    await this.persist(userId, socketId);
    return false;
  }

  async removeActiveUser(userId: string, socketId: string) {
    const userSockets = this.activeUsers.get(userId);

    if (!userSockets) {
      await this.redis
        .run(this.redis.client.sRem(this.userKey(userId), socketId))
        .catch(() => undefined);
      return false;
    }

    userSockets.delete(socketId);
    if (userSockets.size === 0) {
      this.activeUsers.delete(userId);
      await this.redis
        .run(this.redis.client.sRem(this.userKey(userId), socketId))
        .catch(() => undefined);
      return true;
    }
    await this.redis
      .run(this.redis.client.sRem(this.userKey(userId), socketId))
      .catch(() => undefined);
    return false;
  }

  async getActiveUsers(userIds: string[]) {
    const checks = await Promise.all(
      userIds.map(async (id) => {
        const local = this.activeUsers.has(id);
        const remote = await this.redis
          .run(this.redis.client.exists(this.userKey(id)))
          .catch(() => 0);
        return local || Boolean(remote);
      }),
    );
    return userIds.filter((_, index) => checks[index]);
  }

  async refreshActiveUser(userId: string, socketId: string) {
    if (!this.activeUsers.get(userId)?.has(socketId)) return;
    await this.persist(userId, socketId);
  }

  private userKey(userId: string) {
    return this.redisKeys.build('presence', userId);
  }

  private async persist(userId: string, socketId: string) {
    await this.redis
      .run(this.redis.client.sAdd(this.userKey(userId), socketId))
      .catch(() => undefined);
    await this.redis
      .run(this.redis.client.expire(this.userKey(userId), this.ttlSeconds))
      .catch(() => undefined);
  }
}
