import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
} from 'node:crypto';
import { RedisKeyService } from '../../../../infrastructure/redis/redis-key.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';

type OtpChallenge = {
  codeHash?: string;
  attempts?: string;
  purpose?: string;
  deliveryCiphertext?: string;
};

const OTP_TTL_SECONDS = 5 * 60;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    private readonly keys: RedisKeyService,
    private readonly config: ConfigService,
  ) {}

  async issue(
    email: string,
    purpose: string,
  ): Promise<{ code: string; expiresAt: Date }> {
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
          deliveryCiphertext: this.encrypt(code),
        })
        .expire(key, OTP_TTL_SECONDS)
        .exec(),
    );
    return { code, expiresAt };
  }

  /** Worker-only. The OTP is never carried by the outbox event or a log. */
  async revealForDelivery(
    email: string,
    purpose: string,
  ): Promise<string | null> {
    const result = (await this.redis.run(
      this.redis.client.hGetAll(
        this.keys.build('otp', purpose, email.toLowerCase()),
      ),
    )) as OtpChallenge;
    if (!result.deliveryCiphertext) return null;
    try {
      return this.decrypt(result.deliveryCiphertext);
    } catch {
      return null;
    }
  }

  async verify(email: string, purpose: string, code: string): Promise<void> {
    await this.check(email, purpose, code, false);
  }

  async consume(email: string, purpose: string, code: string): Promise<void> {
    const key = this.keys.build('otp', purpose, email.toLowerCase());
    const outcome = (await this.redis.run(
      this.redis.client.eval(
        `
          local codeHash = redis.call('HGET', KEYS[1], 'codeHash')
          local attempts = tonumber(redis.call('HGET', KEYS[1], 'attempts') or '0')
          if not codeHash or attempts >= tonumber(ARGV[2]) then return 0 end
          if codeHash ~= ARGV[1] then
            redis.call('HINCRBY', KEYS[1], 'attempts', 1)
            return 1
          end
          redis.call('DEL', KEYS[1])
          return 2
        `,
        { keys: [key], arguments: [this.hash(code), String(OTP_MAX_ATTEMPTS)] },
      ),
    )) as number;
    if (outcome !== 2) {
      throw new Error(
        outcome === 1 ? 'Invalid OTP' : 'OTP expired or attempts exceeded',
      );
    }
  }

  private async check(
    email: string,
    purpose: string,
    code: string,
    consume: boolean,
  ): Promise<void> {
    const key = this.keys.build('otp', purpose, email.toLowerCase());
    const result = (await this.redis.run(
      this.redis.client.hGetAll(key),
    )) as OtpChallenge;
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

  private key() {
    return createHash('sha256')
      .update(
        this.config.get<string>('OTP_DELIVERY_ENCRYPTION_SECRET') ||
          this.config.getOrThrow<string>('JWT_SECRET'),
      )
      .digest();
  }
  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${body.toString('base64url')}`;
  }
  private decrypt(value: string) {
    const [iv, tag, body] = value.split('.');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key(),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(body, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
