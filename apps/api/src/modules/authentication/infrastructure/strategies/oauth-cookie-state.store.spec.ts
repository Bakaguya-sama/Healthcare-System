import { CookiePkceStateStore } from './oauth-cookie-state.store';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { RedisKeyService } from '../../../../infrastructure/redis/redis-key.service';

describe('CookiePkceStateStore', () => {
  const secret = 'test-secret-long-enough-for-hmac-encryption';
  const verifier = 'a'.repeat(43);
  const redisValues = new Map<string, string>();

  function createStore() {
    redisValues.clear();
    const client = {
      set: jest.fn(async (key: string, value: string) => {
        redisValues.set(key, value);
        return 'OK';
      }),
      eval: jest.fn(async (_script: string, options: { keys: string[] }) => {
        const [key] = options.keys;
        const value = redisValues.get(key) ?? null;
        redisValues.delete(key);
        return value;
      }),
    };
    const redis = {
      client,
      run: (operation: Promise<unknown>) => operation,
    } as unknown as RedisService;
    const keys = {
      build: (...parts: string[]) => parts.join(':'),
    } as unknown as RedisKeyService;
    return {
      store: new CookiePkceStateStore(secret, false, redis, keys),
      client,
    };
  }

  async function start(attemptId?: string) {
    const { store, client } = createStore();
    let cookie = '';
    let state = '';
    const req = {
      query: attemptId ? { attemptId } : {},
      res: {
        cookie: (_name: string, value: string) => (cookie = value),
        clearCookie: jest.fn(),
      },
    };
    const completed = new Promise<void>((resolve) =>
      store.store(req, verifier, null, null, (error, createdState) => {
        expect(error).toBeNull();
        state = createdState ?? '';
        resolve();
      }),
    );
    await completed;
    return { store, client, cookie, state };
  }

  it('uses Redis and a matching browser cookie to consume state once', async () => {
    const { store, client, cookie, state } = await start();
    const req = {
      headers: { cookie: `healthcare_oauth_pkce=${cookie}` },
      res: { cookie: jest.fn(), clearCookie: jest.fn() },
    };
    const callback = jest.fn();
    await new Promise<void>((resolve) =>
      store.verify(req, state, (...args) => {
        callback(...args);
        resolve();
      }),
    );
    expect(callback).toHaveBeenCalledWith(null, verifier);
    expect(client.eval).toHaveBeenCalledTimes(1);

    const replay = jest.fn();
    await new Promise<void>((resolve) =>
      store.verify(req, state, (...args) => {
        replay(...args);
        resolve();
      }),
    );
    expect(replay).toHaveBeenCalledWith(null, false);
  });

  it('binds mobile attempts inside the shared state record, not process memory', async () => {
    const attemptId = 'b'.repeat(43);
    const { store, cookie, state } = await start(attemptId);
    const req = {
      headers: { cookie: `healthcare_oauth_pkce=${cookie}` },
      res: { cookie: jest.fn(), clearCookie: jest.fn() },
    } as { headers: { cookie: string }; res: { cookie: jest.Mock; clearCookie: jest.Mock }; oauthAttemptId?: string };
    await new Promise<void>((resolve) =>
      store.verify(req, state, (error, returnedVerifier) => {
        expect(error).toBeNull();
        expect(returnedVerifier).toBe(verifier);
        resolve();
      }),
    );
    expect(req.oauthAttemptId).toBe(attemptId);
  });

  it('rejects a callback without the initiating browser cookie before Redis consumption', async () => {
    const { store, client, state } = await start();
    const callback = jest.fn();
    store.verify({ headers: {}, res: { cookie: jest.fn(), clearCookie: jest.fn() } }, state, callback);
    await new Promise((resolve) => setImmediate(resolve));
    expect(callback).toHaveBeenCalledWith(null, false);
    expect(client.eval).not.toHaveBeenCalled();
  });
});
