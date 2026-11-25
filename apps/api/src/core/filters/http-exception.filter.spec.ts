import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter request redaction', () => {
  it('omits OAuth query values from logs and error responses', () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const json = jest.fn();
    const response = { status: jest.fn().mockReturnValue({ json }) };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/api/v1/auth/oauth/google/callback?code=secret-code&state=secret-state',
          url: '/callback?code=secret-code&state=secret-state',
        }),
      }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(new BadRequestException('Invalid callback'), host);

    expect(logger).toHaveBeenCalledWith(expect.objectContaining({
      path: '/api/v1/auth/oauth/google/callback',
    }));
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      path: '/api/v1/auth/oauth/google/callback',
    }));
    expect(JSON.stringify(logger.mock.calls)).not.toContain('secret-');
    expect(JSON.stringify(json.mock.calls)).not.toContain('secret-');
    logger.mockRestore();
  });
});
