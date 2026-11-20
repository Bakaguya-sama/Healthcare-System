import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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

type StoredAttemptRecord =
  | { kind: 'session'; payload: OAuthSessionPayload }
  | { kind: 'error'; errorCode: string; message: string };

const HANDOFF_TTL_SECONDS = 60;
const ATTEMPT_TTL_SECONDS = 120;

/**
 * Stores one-time AES-256-GCM encrypted OAuth session payloads in Redis so
 * browser callbacks can hand off to mobile via an opaque short-lived ticket
 * or foreground attemptId rather than placing tokens in redirect URLs.
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

  async storeAttemptSession(
    attemptId: string,
    payload: OAuthSessionPayload,
  ): Promise<void> {
    if (!this.isValidAttemptId(attemptId)) return;
    const key = this.buildKey(`attempt:${attemptId}`);
    const record: StoredAttemptRecord = { kind: 'session', payload };
    await this.redis.run(
      this.redis.client.set(key, this.encrypt(JSON.stringify(record)), {
        EX: ATTEMPT_TTL_SECONDS,
      }),
    );
  }

  async storeAttemptError(
    attemptId: string,
    errorCode: string,
    message: string,
  ): Promise<void> {
    if (!this.isValidAttemptId(attemptId)) return;
    const key = this.buildKey(`attempt:${attemptId}`);
    const record: StoredAttemptRecord = { kind: 'error', errorCode, message };
    await this.redis.run(
      this.redis.client.set(key, this.encrypt(JSON.stringify(record)), {
        EX: ATTEMPT_TTL_SECONDS,
      }),
    );
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

    let parsed: StoredAttemptRecord | OAuthSessionPayload;
    try {
      parsed = JSON.parse(this.decrypt(ciphertext)) as
        | StoredAttemptRecord
        | OAuthSessionPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth handoff ticket');
    }

    if (parsed && typeof parsed === 'object' && 'kind' in parsed) {
      if (parsed.kind === 'error') {
        if (parsed.errorCode === 'local_account_exists') {
          throw new ConflictException(
            parsed.message ||
              'This email already has a password account; sign in with password',
          );
        }
        throw new ForbiddenException(
          parsed.message || 'Google sign-in is unavailable for this account',
        );
      }
      if (parsed.kind === 'session') {
        return parsed.payload;
      }
    }

    return parsed as OAuthSessionPayload;
  }

  private isValidAttemptId(attemptId: string): boolean {
    return /^[a-zA-Z0-9_-]{8,80}$/.test(attemptId);
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
