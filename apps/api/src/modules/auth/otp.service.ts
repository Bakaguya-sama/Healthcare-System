import { Injectable } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import { RedisKeyService } from '../../infrastructure/redis/redis-key.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

type OtpChallenge = {
  codeHash?: string;
  attempts?: string;
  purpose?: string;
};

const OTP_TTL_SECONDS = 5 * 60;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    private readonly keys: RedisKeyService,
  ) {}

  async issue(email: string, purpose: string): Promise<{ code: string; expiresAt: Date }> {
    const code = randomInt(100000, 1000000).toString();
    const key = this.keys.build('otp', purpose, email.toLowerCase());
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
    await this.redis.run(
      this.redis.client
        .multi()
        .hSet(key, {
          codeHash: this.hash(code),
          attempts: '0',
          purpose,
        })
        .expire(key, OTP_TTL_SECONDS)
        .exec(),
    );
    return { code, expiresAt };
  }

  async verify(email: string, purpose: string, code: string): Promise<void> {
    await this.check(email, purpose, code, false);
  }

  async consume(email: string, purpose: string, code: string): Promise<void> {
    await this.check(email, purpose, code, true);
  }

  private async check(
    email: string,
    purpose: string,
    code: string,
    consume: boolean,
  ): Promise<void> {
    const key = this.keys.build('otp', purpose, email.toLowerCase());
    const result = (await this.redis.run(this.redis.client.hGetAll(key))) as OtpChallenge;
    const attempts = Number(result.attempts ?? 0);
    if (!result.codeHash || attempts >= OTP_MAX_ATTEMPTS) {
      throw new Error('OTP expired or attempts exceeded');
    }
    if (this.hash(code) !== result.codeHash) {
      await this.redis.run(this.redis.client.hIncrBy(key, 'attempts', 1));
      throw new Error('Invalid OTP');
    }
    if (consume) await this.redis.run(this.redis.client.del(key));
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
