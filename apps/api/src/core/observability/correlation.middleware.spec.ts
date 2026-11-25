import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { correlationMiddleware } from './correlation.middleware';

describe('correlationMiddleware request redaction', () => {
  it('logs only the path when an OAuth callback contains query secrets', () => {
    const logger = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    let finish: () => void = () => undefined;
    const request = {
      header: () => undefined,
      method: 'GET',
      originalUrl: '/api/v1/auth/oauth/google/callback?code=secret-code&state=secret-state',
    } as unknown as Request;
    const response = {
      setHeader: jest.fn(),
      on: (_event: string, handler: () => void) => { finish = handler; },
      statusCode: 200,
    } as unknown as Response;

    correlationMiddleware(request, response, jest.fn() as NextFunction);
    finish();

    expect(logger).toHaveBeenCalledWith(expect.objectContaining({
      path: '/api/v1/auth/oauth/google/callback',
    }));
    expect(JSON.stringify(logger.mock.calls)).not.toContain('secret-');
    logger.mockRestore();
  });
});
