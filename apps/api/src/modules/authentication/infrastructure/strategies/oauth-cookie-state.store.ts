import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

type RequestWithResponse = {
  headers?: { cookie?: string };
  res?: {
    cookie: (
      name: string,
      value: string,
      options: Record<string, unknown>,
    ) => void;
    clearCookie: (name: string, options: Record<string, unknown>) => void;
  };
};
/** Stateless Passport state store: browser gets an encrypted HttpOnly short-lived cookie, no OAuth state collection. */
export class CookiePkceStateStore {
  private readonly name = 'healthcare_oauth_pkce';
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
    try {
      req.res?.cookie(
        this.name,
        this.encrypt(
          JSON.stringify({ handle, verifier, expiresAt: Date.now() + 300_000 }),
        ),
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
    try {
      const raw = this.cookie(req.headers?.cookie);
      req.res?.clearCookie(this.name, {
        httpOnly: true,
        secure: this.secure,
        sameSite: 'lax',
        path: this.path,
      });
      if (!raw) return callback(null, false);
      const state = JSON.parse(this.decrypt(raw)) as {
        handle: string;
        verifier: string;
        expiresAt: number;
      };
      const equal =
        state.handle.length === provided.length &&
        timingSafeEqual(Buffer.from(state.handle), Buffer.from(provided));
      callback(
        null,
        equal && state.expiresAt > Date.now() ? state.verifier : false,
      );
    } catch (error) {
      callback(
        error instanceof Error
          ? error
          : new Error('OAuth state verification failed'),
      );
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
