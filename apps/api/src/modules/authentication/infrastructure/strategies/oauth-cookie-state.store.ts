import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { RedisKeyService } from '../../../../infrastructure/redis/redis-key.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';

type RequestWithResponse = {
  headers?: { cookie?: string };
  query?: Record<string, unknown>;
  oauthAttemptId?: string;
  res?: {
    cookie: (name: string, value: string, options: Record<string, unknown>) => void;
    clearCookie: (name: string, options: Record<string, unknown>) => void;
  };
};

type StoredOAuthState = {
  verifier: string;
  expiresAt: number;
  attemptId?: string;
};

/** Redis-backed, one-time Passport state/Google-PKCE verifier store.
 * The browser cookie binds the callback to the browser that started OAuth;
 * Redis makes consumption atomic across API instances.
 */
export class CookiePkceStateStore {
  private readonly name = 'healthcare_oauth_pkce';

  constructor(
    private readonly secret: string,
    private readonly secure: boolean,
    private readonly redis: RedisService,
    private readonly keys: RedisKeyService,
    private readonly path = '/api/v1/auth/oauth/google',
  ) {}

  store(
    req: RequestWithResponse,
    verifier: string,
    _state: unknown,
    _meta: unknown,
    callback: (error: Error | null, state?: string) => void,
  ) {
    void (async () => {
      const handle = randomBytes(32).toString('base64url');
      const expiresAt = Date.now() + 300_000;
      const rawAttempt = req.query?.attemptId;
      const attemptId =
        typeof rawAttempt === 'string' &&
        /^[A-Za-z0-9_-]{43}$/.test(rawAttempt)
          ? rawAttempt
          : undefined;
      try {
        const result = await this.redis.run(
          this.redis.client.set(
            this.stateKey(handle),
            this.encrypt(JSON.stringify({ verifier, expiresAt, attemptId })),
            { EX: 300, NX: true },
          ),
        );
        if (result !== 'OK') throw new Error('OAuth state could not be reserved');
        req.res?.cookie(this.name, handle, {
          httpOnly: true,
          secure: this.secure,
          sameSite: 'lax',
          path: this.path,
          maxAge: 300_000,
        });
        callback(null, handle);
      } catch {
        callback(new Error('OAuth state persistence failed'));
      }
    })();
  }

  verify(
    req: RequestWithResponse,
    provided: string,
    callback: (
      error: Error | null,
      verifier?: string | false,
      state?: unknown,
    ) => void,
  ) {
    void (async () => {
      const cookie = this.cookie(req.headers?.cookie);
      req.res?.clearCookie(this.name, {
        httpOnly: true,
        secure: this.secure,
        sameSite: 'lax',
        path: this.path,
      });
      if (!cookie || !this.equal(cookie, provided)) {
        callback(null, false);
        return;
      }
      try {
        const ciphertext = (await this.redis.run(
          this.redis.client.eval(
            "local value=redis.call('GET',KEYS[1]); if not value then return nil end; redis.call('DEL',KEYS[1]); return value",
            { keys: [this.stateKey(provided)], arguments: [] },
          ),
        )) as string | null;
        if (!ciphertext) {
          callback(null, false);
          return;
        }
        const stored = JSON.parse(this.decrypt(ciphertext)) as StoredOAuthState;
        if (!stored.verifier || stored.expiresAt <= Date.now()) {
          callback(null, false);
          return;
        }
        if (stored.attemptId) req.oauthAttemptId = stored.attemptId;
        callback(null, stored.verifier);
      } catch {
        callback(new Error('OAuth state verification failed'));
      }
    })();
  }

  private stateKey(handle: string) {
    const digest = createHash('sha256').update(handle).digest('hex');
    return this.keys.build('oauth', 'state', digest);
  }

  private cookie(header?: string) {
    return header
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${this.name}=`))
      ?.slice(this.name.length + 1);
  }

  private equal(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right ?? '');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private key() {
    return createHash('sha256').update(this.secret).digest();
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const payload = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${payload.toString('base64url')}`;
  }

  private decrypt(value: string) {
    const [iv, tag, payload] = value.split('.');
    if (!iv || !tag || !payload) throw new Error('Malformed OAuth state');
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(payload, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
