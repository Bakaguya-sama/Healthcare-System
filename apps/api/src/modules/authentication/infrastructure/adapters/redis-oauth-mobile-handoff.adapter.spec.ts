import { createHash, randomBytes } from 'node:crypto';
import { RedisOAuthMobileHandoffAdapter } from './redis-oauth-mobile-handoff.adapter';

describe('RedisOAuthMobileHandoffAdapter proof-of-possession', () => {
  const records = new Map<string, string | Record<string, string>>();
  const makeAdapter = () => {
    records.clear();
    const client = {
      set: jest.fn(async (key: string, value: string) => {
        if (records.has(key)) return null;
        records.set(key, value);
        return 'OK';
      }),
      eval: jest.fn(async (script: string, options: { keys: string[]; arguments: string[] }) => {
        const [key] = options.keys;
        const current = records.get(key);
        if (script.includes("kind ~= 'string'")) {
          if (typeof current !== 'string') return 0;
          const [ticketHash, payload] = options.arguments;
          records.set(key, { status: 'pending', challenge: current, ticketHash, payload });
          return 1;
        }
        if (!current || typeof current === 'string') return null;
        const [ticketHash, challenge] = options.arguments;
        if (current.status !== 'pending' || current.ticketHash !== ticketHash || current.challenge !== challenge) return null;
        records.delete(key);
        return current.payload;
      }),
    };
    const redis = { client, run: (operation: Promise<unknown>) => operation } as never;
    const keys = { build: (...parts: string[]) => parts.join(':') } as never;
    const config = {
      get: () => undefined,
      getOrThrow: () => 'test-secret-long-enough-for-handoff-encryption',
    } as never;
    return { adapter: new RedisOAuthMobileHandoffAdapter(redis, keys, config), client };
  };

  function proof() {
    const verifier = randomBytes(32).toString('base64url');
    return {
      verifier,
      challenge: createHash('sha256').update(verifier).digest('base64url'),
    };
  }

  it('requires the verifier and permits one successful exchange only', async () => {
    const { adapter } = makeAdapter();
    const { verifier, challenge } = proof();
    const { attemptId } = await adapter.beginAttempt(challenge);
    const principal = {
      provider: 'google' as const,
      providerAccountId: 'google-subject-1',
      email: 'patient@example.com',
      emailVerified: true,
    };
    const ticket = await adapter.storeCallback(attemptId, principal);
    await expect(adapter.consume(attemptId, ticket, 'x'.repeat(43))).rejects.toThrow();
    await expect(adapter.consume(attemptId, ticket, verifier)).resolves.toEqual(principal);
    await expect(adapter.consume(attemptId, ticket, verifier)).rejects.toThrow();
  });

  it('allows only one successful concurrent exchange', async () => {
    const { adapter } = makeAdapter();
    const { verifier, challenge } = proof();
    const { attemptId } = await adapter.beginAttempt(challenge);
    const ticket = await adapter.storeCallback(attemptId, {
      provider: 'google',
      providerAccountId: 'google-subject-2',
      emailVerified: false,
    });
    const results = await Promise.allSettled([
      adapter.consume(attemptId, ticket, verifier),
      adapter.consume(attemptId, ticket, verifier),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('generates the attempt server-side and fails closed without the full tuple', async () => {
    const { adapter } = makeAdapter();
    const { challenge } = proof();
    const started = await adapter.beginAttempt(challenge);
    expect(started.attemptId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await expect(adapter.consume('a'.repeat(43), 'b'.repeat(43), 'c'.repeat(43))).rejects.toThrow();
  });
});
