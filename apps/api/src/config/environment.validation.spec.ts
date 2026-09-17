import { validateEnvironment } from './environment.validation';

const validConfig = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://mongo:27017/healthcare',
  JWT_SECRET: 'a-production-secret-with-32-characters',
  CORS_ORIGINS: 'https://app.example.com',
  SWAGGER_ENABLED: 'false',
};

describe('validateEnvironment', () => {
  it('normalizes supported runtime values', () => {
    expect(
      validateEnvironment({
        ...validConfig,
        NODE_ENV: 'test',
        PORT: '3100',
        API_PREFIX: '/api/',
        SOCKET_PATH: 'realtime',
        SWAGGER_ENABLED: 'true',
      }),
    ).toMatchObject({
      PORT: 3100,
      API_PREFIX: 'api',
      SOCKET_PATH: '/realtime',
      SWAGGER_ENABLED: true,
      THROTTLE_ENABLED: false,
    });
  });

  it('enables throttling by default only in staging and production', () => {
    expect(validateEnvironment(validConfig).THROTTLE_ENABLED).toBe(true);
    expect(
      validateEnvironment({
        ...validConfig,
        NODE_ENV: 'development',
        SWAGGER_ENABLED: 'true',
      }).THROTTLE_ENABLED,
    ).toBe(false);
    expect(
      validateEnvironment({
        ...validConfig,
        THROTTLE_ENABLED: 'false',
      }).THROTTLE_ENABLED,
    ).toBe(false);
  });

  it('rejects a missing production CORS allowlist', () => {
    expect(() =>
      validateEnvironment({ ...validConfig, CORS_ORIGINS: undefined }),
    ).toThrow('CORS_ORIGINS');
  });

  it('rejects weak secrets and production Swagger exposure', () => {
    expect(() =>
      validateEnvironment({ ...validConfig, JWT_SECRET: 'weak' }),
    ).toThrow('JWT_SECRET');
    expect(() =>
      validateEnvironment({ ...validConfig, SWAGGER_ENABLED: 'true' }),
    ).toThrow('SWAGGER_ENABLED');
  });
});
