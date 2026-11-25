import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { RedisKeyService } from '../../../../infrastructure/redis/redis-key.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import {
  OAuthMobileHandoffPort,
  PendingGooglePrincipal,
} from '../../application/ports/oauth-mobile-handoff.port';
import { GoogleOAuthError } from '../../application/errors/google-oauth.error';

const MOBILE_ATTEMPT_TTL_SECONDS = 300;
const MOBILE_TICKET_TTL_SECONDS = 60;
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const OPAQUE_VALUE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Redis adapter: shared TTL storage and atomic one-time ticket consumption. */
@Injectable()
export class RedisOAuthMobileHandoffAdapter implements OAuthMobileHandoffPort {
  constructor(
    private readonly redis: RedisService,
    private readonly keys: RedisKeyService,
    private readonly config: ConfigService,
  ) {}

  async beginAttempt(challenge: string): Promise<{ attemptId: string }> {
    if (!CHALLENGE_PATTERN.test(challenge))
      throw new GoogleOAuthError('GOOGLE_OAUTH_INVALID_CHALLENGE');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const attemptId = randomBytes(32).toString('base64url');
      let result: string | null;
      try {
        result = await this.redis.run(
          this.redis.client.set(this.attemptKey(attemptId), challenge, {
            EX: MOBILE_ATTEMPT_TTL_SECONDS,
            NX: true,
          }),
        );
      } catch {
        throw new GoogleOAuthError('GOOGLE_OAUTH_UNAVAILABLE');
      }
      if (result === 'OK') return { attemptId };
    }
    throw new GoogleOAuthError('GOOGLE_OAUTH_UNAVAILABLE');
  }

  async storeCallback(
    attemptId: string,
    principal: PendingGooglePrincipal,
  ): Promise<string> {
    if (!OPAQUE_VALUE_PATTERN.test(attemptId))
      throw new GoogleOAuthError('GOOGLE_OAUTH_HANDOFF_INVALID');
    const ticket = randomBytes(32).toString('base64url');
    let stored: unknown;
    try {
      stored = await this.redis.run(
        this.redis.client.eval(
          `
          local kind = redis.call('TYPE', KEYS[1]).ok
          if kind ~= 'string' then return 0 end
          local challenge = redis.call('GET', KEYS[1])
          if not challenge then return 0 end
          local remaining = redis.call('PTTL', KEYS[1])
          if remaining <= 0 then return 0 end
          redis.call('DEL', KEYS[1])
          redis.call('HSET', KEYS[1], 'status', 'pending', 'challenge', challenge,
            'ticketHash', ARGV[1], 'payload', ARGV[2])
          redis.call('PEXPIRE', KEYS[1], math.min(remaining, tonumber(ARGV[3]) * 1000))
          return 1
        `,
          {
            keys: [this.attemptKey(attemptId)],
            arguments: [
              this.digest(ticket),
              this.encrypt(JSON.stringify(principal)),
              String(MOBILE_TICKET_TTL_SECONDS),
            ],
          },
        ),
      );
    } catch {
      throw new GoogleOAuthError('GOOGLE_OAUTH_UNAVAILABLE');
    }
    if (Number(stored) !== 1)
      throw new GoogleOAuthError('GOOGLE_OAUTH_HANDOFF_INVALID');
    return ticket;
  }

  async consume(
    attemptId: string,
    ticket: string,
    verifier: string,
  ): Promise<PendingGooglePrincipal> {
    if (
      !OPAQUE_VALUE_PATTERN.test(attemptId) ||
      !OPAQUE_VALUE_PATTERN.test(ticket) ||
      !VERIFIER_PATTERN.test(verifier)
    )
      throw new GoogleOAuthError('GOOGLE_OAUTH_HANDOFF_INVALID');
    const verifierChallenge = createHash('sha256')
      .update(verifier)
      .digest('base64url');
    let ciphertext: string | null;
    try {
      ciphertext = (await this.redis.run(
        this.redis.client.eval(
          `
          if redis.call('TYPE', KEYS[1]).ok ~= 'hash' then return nil end
          if redis.call('HGET', KEYS[1], 'status') ~= 'pending' then return nil end
          if redis.call('HGET', KEYS[1], 'ticketHash') ~= ARGV[1] then return nil end
          if redis.call('HGET', KEYS[1], 'challenge') ~= ARGV[2] then return nil end
          local payload = redis.call('HGET', KEYS[1], 'payload')
          redis.call('DEL', KEYS[1])
          return payload
        `,
          {
            keys: [this.attemptKey(attemptId)],
            arguments: [this.digest(ticket), verifierChallenge],
          },
        ),
      )) as string | null;
    } catch {
      throw new GoogleOAuthError('GOOGLE_OAUTH_UNAVAILABLE');
    }
    if (!ciphertext) throw new GoogleOAuthError('GOOGLE_OAUTH_HANDOFF_INVALID');
    try {
      const principal = JSON.parse(
        this.decrypt(ciphertext),
      ) as PendingGooglePrincipal;
      if (
        principal.provider !== 'google' ||
        !principal.providerAccountId ||
        typeof principal.emailVerified !== 'boolean'
      )
        throw new Error('Invalid pending principal');
      return principal;
    } catch {
      throw new GoogleOAuthError('GOOGLE_OAUTH_HANDOFF_INVALID');
    }
  }

  private attemptKey(attemptId: string) {
    return this.keys.build('oauth', 'mobile-attempt', this.digest(attemptId));
  }

  private digest(value: string) {
    return createHash('sha256').update(value).digest('hex');
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

  private decrypt(value: string): string {
    const [iv, tag, body] = value.split('.');
    if (!iv || !tag || !body) throw new Error('Malformed handoff record');
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
