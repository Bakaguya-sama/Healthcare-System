import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController legacy characterization', () => {
  it('delegates login and preserves its response', async () => {
    const response = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    };
    const authService = {
      login: jest.fn().mockResolvedValue(response),
    };
    const controller = new AuthController(
      authService as unknown as AuthService,
    );

    await expect(
      controller.login({ email: 'user@example.com', password: 'password' }),
    ).resolves.toBe(response);
  });
});
