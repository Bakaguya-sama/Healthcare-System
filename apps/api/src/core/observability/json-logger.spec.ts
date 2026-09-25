import { CorrelationContext } from './correlation-context';
import { JsonLogger, redactLogValue } from './json-logger';

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
});
