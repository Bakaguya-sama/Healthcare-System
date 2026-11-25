import { CorrelationContext } from './correlation-context';
import { JsonLogger, redactError, redactLogValue } from './json-logger';

describe('JsonLogger redaction', () => {
  it('redacts nested credentials and bearer tokens', () => {
    expect(
      redactLogValue({
        email: 'patient@example.com',
        password: 'plain-secret',
        nested: { refreshToken: 'refresh-secret' },
        authorization: 'Bearer header.payload.signature',
      }),
    ).toEqual({
      email: 'patient@example.com',
      password: '[REDACTED]',
      nested: { refreshToken: '[REDACTED]' },
      authorization: '[REDACTED]',
    });
  });

  it('adds the active correlation ID to JSON output', () => {
    const output = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    CorrelationContext.run('request-123', () => {
      new JsonLogger().log({ event: 'test', apiKey: 'secret-value' });
    });

    expect(JSON.parse(String(output.mock.calls[0][0]))).toMatchObject({
      level: 'info',
      correlationId: 'request-123',
      message: { event: 'test', apiKey: '[REDACTED]' },
    });
    output.mockRestore();
  });

  it('preserves redacted nested failures from AggregateError', () => {
    const nested = new Error('Redis rejected password=redis-secret');
    const aggregate = new AggregateError(
      [nested, new Error('Mongo unavailable')],
      'bootstrap dependencies failed',
    );

    expect(redactError(aggregate)).toMatchObject({
      name: 'AggregateError',
      message: 'bootstrap dependencies failed',
      errors: [
        {
          name: 'Error',
          message: 'Redis rejected password=[REDACTED]',
        },
        { name: 'Error', message: 'Mongo unavailable' },
      ],
    });
  });

  it('preserves a redacted error cause', () => {
    const root = new Error('startup failed', {
      cause: new Error('Bearer secret.token.value'),
    });

    expect(redactError(root)).toMatchObject({
      name: 'Error',
      message: 'startup failed',
      cause: {
        name: 'Error',
        message: 'Bearer [REDACTED]',
      },
    });
  });
});
