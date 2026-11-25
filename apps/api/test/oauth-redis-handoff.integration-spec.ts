import { createHash, randomBytes } from 'node:crypto';
import { createClient } from 'redis';
import { RedisKeyService } from '../src/infrastructure/redis/redis-key.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { CookiePkceStateStore } from '../src/modules/authentication/infrastructure/strategies/oauth-cookie-state.store';
import { RedisOAuthMobileHandoffAdapter } from '../src/modules/authentication/infrastructure/adapters/redis-oauth-mobile-handoff.adapter';

describe('OAuth Redis handoff integration', () => {
  const namespace = `oauth_it_${randomBytes(6).toString('hex')}`;
  const client = createClient({
    url: process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:16379',
  });
  const config = {
    get: (key: string) =>
      key === 'OAUTH_STATE_ENCRYPTION_SECRET'
        ? 'integration-test-oauth-state-secret-at-least-32-bytes'
        : undefined,
    getOrThrow: (key: string) =>
      key === 'REDIS_NAMESPACE' ? namespace : 'integration-test-jwt-secret',
  } as never;
  const keys = new RedisKeyService(config);
  const redis = new RedisService(client as never, {
    getOrThrow: () => 2_000,
  } as never);
  const trackedKeys = new Set<string>();

  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    if (trackedKeys.size) await client.del([...trackedKeys]);
    await client.quit();
  });

  it('consumes browser PKCE state across instances and rejects callback replay', async () => {
    const verifier = randomBytes(32).toString('base64url');
    const firstInstance = new CookiePkceStateStore(
      'integration-test-oauth-state-secret-at-least-32-bytes',
      false,
      redis,
      keys,
    );
    const secondInstance = new CookiePkceStateStore(
      'integration-test-oauth-state-secret-at-least-32-bytes',
      false,
      redis,
      keys,
    );
    let cookie = '';
    let state = '';
    await new Promise<void>((resolve, reject) => {
      firstInstance.store(
        { res: { cookie: (_name, value) => (cookie = value), clearCookie: () => undefined } },
        verifier,
        null,
        null,
        (error, value) => {
          if (error) return reject(error);
          state = value ?? '';
          resolve();
        },
      );
    });
    trackedKeys.add(
      keys.build('oauth', 'state', createHash('sha256').update(state).digest('hex')),
    );
    const callbackRequest = {
      headers: { cookie: `healthcare_oauth_pkce=${cookie}` },
      res: { cookie: () => undefined, clearCookie: () => undefined },
    };
    const first = jest.fn();
    await new Promise<void>((resolve) =>
      secondInstance.verify(callbackRequest, state, (...args) => {
        first(...args);
        resolve();
      }),
    );
    expect(first).toHaveBeenCalledWith(null, verifier);

    const replay = jest.fn();
    await new Promise<void>((resolve) =>
      secondInstance.verify(callbackRequest, state, (...args) => {
        replay(...args);
        resolve();
      }),
    );
    expect(replay).toHaveBeenCalledWith(null, false);
  });

  it('shares callback state across adapter instances and atomically permits one verifier-bound exchange', async () => {
    const apiInstanceA = new RedisOAuthMobileHandoffAdapter(redis, keys, config);
    const apiInstanceB = new RedisOAuthMobileHandoffAdapter(redis, keys, config);
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const { attemptId } = await apiInstanceA.beginAttempt(challenge);
    const ticket = await apiInstanceB.storeCallback(attemptId, {
      provider: 'google',
      providerAccountId: randomBytes(8).toString('hex'),
      email: 'synthetic@example.test',
      emailVerified: true,
    });
    trackedKeys.add(
      keys.build(
        'oauth',
        'mobile-attempt',
        createHash('sha256').update(attemptId).digest('hex'),
      ),
    );
    await expect(
      apiInstanceA.consume(attemptId, ticket, randomBytes(32).toString('base64url')),
    ).rejects.toThrow();
    const results = await Promise.allSettled([
      apiInstanceA.consume(attemptId, ticket, verifier),
      apiInstanceB.consume(attemptId, ticket, verifier),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('rejects an authorization URL copied from an attacker browser without its browser cookie', async () => {
    const attackerInstance = new RedisOAuthMobileHandoffAdapter(redis, keys, config);
    const attackerVerifier = randomBytes(32).toString('base64url');
    const attackerChallenge = createHash('sha256')
      .update(attackerVerifier)
      .digest('base64url');
    const { attemptId } = await attackerInstance.beginAttempt(attackerChallenge);

    const stateStore = new CookiePkceStateStore(
      'integration-test-oauth-state-secret-at-least-32-bytes',
      false,
      redis,
      keys,
    );
    let attackerBrowserCookie = '';
    let copiedAuthorizationState = '';
    await new Promise<void>((resolve, reject) => {
      stateStore.store(
        {
          query: { attemptId },
          res: {
            cookie: (_name, value) => (attackerBrowserCookie = value),
            clearCookie: () => undefined,
          },
        },
        randomBytes(32).toString('base64url'),
        null,
        null,
        (error, value) => {
          if (error) return reject(error);
          copiedAuthorizationState = value ?? '';
          resolve();
        },
      );
    });
    trackedKeys.add(
      keys.build(
        'oauth',
        'state',
        createHash('sha256').update(copiedAuthorizationState).digest('hex'),
      ),
    );
    trackedKeys.add(
      keys.build(
        'oauth',
        'mobile-attempt',
        createHash('sha256').update(attemptId).digest('hex'),
      ),
    );

    const victimCallback = jest.fn();
    await new Promise<void>((resolve) =>
      stateStore.verify(
        {
          headers: { cookie: 'healthcare_oauth_pkce=victim-browser-cookie' },
          res: { cookie: () => undefined, clearCookie: () => undefined },
        },
        copiedAuthorizationState,
        (...args) => {
          victimCallback(...args);
          resolve();
        },
      ),
    );

    expect(victimCallback).toHaveBeenCalledWith(null, false);
    await expect(
      attackerInstance.consume(
        attemptId,
        randomBytes(32).toString('base64url'),
        attackerVerifier,
      ),
    ).rejects.toThrow();
    expect(attackerBrowserCookie).toBeTruthy();
  });

  it('rejects an expired app attempt and expired handoff ticket', async () => {
    const adapter = new RedisOAuthMobileHandoffAdapter(redis, keys, config);
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const expiredAttempt = await adapter.beginAttempt(challenge);
    const key = keys.build(
      'oauth',
      'mobile-attempt',
      createHash('sha256').update(expiredAttempt.attemptId).digest('hex'),
    );
    trackedKeys.add(key);
    await client.del(key);
    await expect(
      adapter.storeCallback(expiredAttempt.attemptId, {
        provider: 'google',
        providerAccountId: 'synthetic-expired-attempt',
        emailVerified: false,
      }),
    ).rejects.toThrow();

    const activeAttempt = await adapter.beginAttempt(challenge);
    const ticket = await adapter.storeCallback(activeAttempt.attemptId, {
      provider: 'google',
      providerAccountId: 'synthetic-expired-ticket',
      emailVerified: false,
    });
    const ticketKey = keys.build(
      'oauth',
      'mobile-attempt',
      createHash('sha256').update(activeAttempt.attemptId).digest('hex'),
    );
    trackedKeys.add(ticketKey);
    await client.del(ticketKey);
    await expect(
      adapter.consume(activeAttempt.attemptId, ticket, verifier),
    ).rejects.toThrow();
  });

  it('never extends the original five-minute attempt when issuing a ticket', async () => {
    const adapter = new RedisOAuthMobileHandoffAdapter(redis, keys, config);
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const { attemptId } = await adapter.beginAttempt(challenge);
    const key = keys.build(
      'oauth',
      'mobile-attempt',
      createHash('sha256').update(attemptId).digest('hex'),
    );
    trackedKeys.add(key);
    await client.pExpire(key, 10_000);
    await adapter.storeCallback(attemptId, {
      provider: 'google',
      providerAccountId: 'synthetic-short-lived-attempt',
      emailVerified: false,
    });
    const remaining = await client.pTTL(key);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(10_000);
  });
});
