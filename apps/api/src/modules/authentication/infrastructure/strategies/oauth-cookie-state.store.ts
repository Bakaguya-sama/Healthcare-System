import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

type RequestWithResponse = {
  headers?: { cookie?: string };
  query?: Record<string, unknown>;
  oauthAttemptId?: string;
  res?: {
    cookie: (
      name: string,
      value: string,
      options: Record<string, unknown>,
    ) => void;
    clearCookie: (name: string, options: Record<string, unknown>) => void;
  };
};

type PendingStateEntry = {
  verifier: string;
  expiresAt: number;
  attemptId?: string;
};

/** Stateless Passport state store: browser gets an encrypted HttpOnly short-lived cookie, with a bounded one-time fallback for cross-host mobile emulator redirects. */
export class CookiePkceStateStore {
  private readonly name = 'healthcare_oauth_pkce';
  private readonly pendingStates = new Map<string, PendingStateEntry>();
  constructor(
    private readonly secret: string,
    private readonly secure: boolean,
    private readonly path = '/api/v1/auth/oauth/google',
  ) {}
  store(
    req: RequestWithResponse,
    verifier: string,
    _state: unknown,
    _meta: unknown,
    callback: (error: Error | null, state?: string) => void,
  ) {
    const handle = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + 300_000;
    const rawAttempt = req.query?.attemptId;
    const attemptId =
      typeof rawAttempt === 'string' &&
      /^[a-zA-Z0-9_-]{8,80}$/.test(rawAttempt)
        ? rawAttempt
        : undefined;
    try {
      this.pruneExpiredStates();
      this.pendingStates.set(handle, { verifier, expiresAt, attemptId });
      req.res?.cookie(
        this.name,
        this.encrypt(JSON.stringify({ handle, verifier, expiresAt, attemptId })),
        {
          httpOnly: true,
          secure: this.secure,
          sameSite: 'lax',
          path: this.path,
          maxAge: 300_000,
        },
      );
      callback(null, handle);
    } catch (error) {
      this.pendingStates.delete(handle);
      callback(
        error instanceof Error
          ? error
          : new Error('OAuth state persistence failed'),
      );
    }
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
    const pending = provided ? this.pendingStates.get(provided) : undefined;
    if (provided) {
      this.pendingStates.delete(provided);
    }
    try {
      const raw = this.cookie(req.headers?.cookie);
      req.res?.clearCookie(this.name, {
        httpOnly: true,
        secure: this.secure,
        sameSite: 'lax',
        path: this.path,
      });
      if (!raw) {
        if (pending && pending.expiresAt > Date.now()) {
          if (pending.attemptId) {
            req.oauthAttemptId = pending.attemptId;
          }
          return callback(null, pending.verifier);
        }
        return callback(null, false);
      }
      const state = JSON.parse(this.decrypt(raw)) as {
        handle: string;
        verifier: string;
        expiresAt: number;
        attemptId?: string;
      };
      const equal =
        state.handle.length === provided.length &&
        timingSafeEqual(Buffer.from(state.handle), Buffer.from(provided));
      const valid = equal && state.expiresAt > Date.now();
      if (valid) {
        const resolvedAttemptId = state.attemptId ?? pending?.attemptId;
        if (resolvedAttemptId) {
          req.oauthAttemptId = resolvedAttemptId;
        }
      }
      callback(null, valid ? state.verifier : false);
    } catch (error) {
      callback(
        error instanceof Error
          ? error
          : new Error('OAuth state verification failed'),
      );
    }
  }

  private pruneExpiredStates() {
    const now = Date.now();
    for (const [key, entry] of this.pendingStates.entries()) {
      if (entry.expiresAt <= now) {
        this.pendingStates.delete(key);
      }
    }
    while (this.pendingStates.size >= 1000) {
      const oldestKey = this.pendingStates.keys().next().value;
      if (!oldestKey) break;
      this.pendingStates.delete(oldestKey);
    }
  }

  private cookie(header?: string) {
    return header
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${this.name}=`))
      ?.slice(this.name.length + 1);
  }

  private key() {
    return createHash('sha256').update(this.secret).digest();
  }

  private encrypt(value: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key(), iv),
      payload = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${payload.toString('base64url')}`;
  }

  private decrypt(value: string) {
    const [iv, tag, payload] = value.split('.');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key(),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(payload, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
