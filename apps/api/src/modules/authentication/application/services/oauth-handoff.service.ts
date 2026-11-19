import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { RedisKeyService } from '../../../../infrastructure/redis/redis-key.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';

export type OAuthSessionPayload = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email?: string;
    fullName: string;
    role: string;
    avatarUrl?: string;
  };
};

const HANDOFF_TTL_SECONDS = 60;

/**
 * Stores one-time AES-256-GCM encrypted OAuth session payloads in Redis so
 * browser callbacks can hand off to mobile via an opaque short-lived ticket
 * rather than placing bearer or refresh tokens in redirect URLs.
 */
@Injectable()
export class OAuthHandoffService {
  constructor(
    private readonly redis: RedisService,
    private readonly keys: RedisKeyService,
    private readonly config: ConfigService,
  ) {}

  async issue(payload: OAuthSessionPayload): Promise<string> {
    const ticket = randomBytes(32).toString('base64url');
    const key = this.buildKey(ticket);
    const ciphertext = this.encrypt(JSON.stringify(payload));
    await this.redis.run(
      this.redis.client.set(key, ciphertext, { EX: HANDOFF_TTL_SECONDS }),
    );
    return ticket;
  }

  async consume(ticket: string): Promise<OAuthSessionPayload> {
    const normalized = ticket?.trim();
    if (!normalized) {
      throw new UnauthorizedException('Invalid or expired OAuth handoff ticket');
    }
    const key = this.buildKey(normalized);
    const ciphertext = (await this.redis.run(
      this.redis.client.eval(
        `
          local value = redis.call('GET', KEYS[1])
          if not value then return nil end
          redis.call('DEL', KEYS[1])
          return value
        `,
        { keys: [key], arguments: [] },
      ),
    )) as string | null;

    if (!ciphertext) {
      throw new UnauthorizedException('Invalid or expired OAuth handoff ticket');
    }

    try {
      return JSON.parse(this.decrypt(ciphertext)) as OAuthSessionPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth handoff ticket');
    }
  }

  private buildKey(ticket: string): string {
    const digest = createHash('sha256').update(ticket).digest('hex');
    return this.keys.build('oauth', 'handoff', digest);
  }

  private secretKey(): Buffer {
    return createHash('sha256')
      .update(
        this.config.get<string>('OAUTH_STATE_ENCRYPTION_SECRET') ||
          this.config.getOrThrow<string>('JWT_SECRET'),
      )
      .digest();
  }

  private encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.secretKey(), iv);
    const body = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${body.toString('base64url')}`;
  }

  private decrypt(ciphertext: string): string {
    const [iv, tag, body] = ciphertext.split('.');
    if (!iv || !tag || !body) {
      throw new Error('Malformed encrypted payload');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.secretKey(),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(body, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}

