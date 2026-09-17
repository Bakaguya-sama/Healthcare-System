export type NodeEnvironment = 'development' | 'test' | 'staging' | 'production';

const NODE_ENVIRONMENTS = new Set<NodeEnvironment>([
  'development',
  'test',
  'staging',
  'production',
]);

function requiredString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

function integer(
  config: Record<string, unknown>,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = config[key] ?? fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${key} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

function boolean(
  config: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const raw = config[key];
  if (raw === undefined || raw === '') return fallback;
  if (raw === true || raw === 'true') return true;
  if (raw === false || raw === 'false') return false;
  throw new Error(`${key} must be true or false`);
}

function stringValue(
  config: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = config[key];
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`${key} must be a string`);
  }
  return String(value);
}

function normalizePath(
  config: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const normalized = stringValue(config, key, fallback)
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (!normalized) throw new Error('API_PREFIX cannot be empty');
  return normalized;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const config = { ...input };
  const nodeEnv = stringValue(
    config,
    'NODE_ENV',
    'development',
  ) as NodeEnvironment;
  if (!NODE_ENVIRONMENTS.has(nodeEnv)) {
    throw new Error(
      'NODE_ENV must be development, test, staging or production',
    );
  }

  const jwtSecret = requiredString(config, 'JWT_SECRET');
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }

  const mongodbUri = requiredString(config, 'MONGODB_URI');
  if (!/^mongodb(?:\+srv)?:\/\//.test(mongodbUri)) {
    throw new Error('MONGODB_URI must be a MongoDB connection string');
  }

  const corsOrigins = stringValue(
    config,
    'CORS_ORIGINS',
    nodeEnv === 'production'
      ? ''
      : 'http://localhost:5173,http://localhost:5174',
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (corsOrigins.length === 0 || corsOrigins.includes('*')) {
    throw new Error('CORS_ORIGINS must be a non-empty allowlist without *');
  }

  const swaggerEnabled = boolean(
    config,
    'SWAGGER_ENABLED',
    nodeEnv !== 'production',
  );
  if (nodeEnv === 'production' && swaggerEnabled) {
    throw new Error('SWAGGER_ENABLED must be false in production');
  }

  const throttleEnabled = boolean(
    config,
    'THROTTLE_ENABLED',
    nodeEnv === 'staging' || nodeEnv === 'production',
  );

  const bodyLimit = stringValue(config, 'BODY_LIMIT', '1mb')
    .trim()
    .toLowerCase();
  if (!/^\d+(?:kb|mb)$/.test(bodyLimit)) {
    throw new Error('BODY_LIMIT must use the form 256kb or 1mb');
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: integer(config, 'PORT', 3000, 1, 65_535),
    API_PREFIX: normalizePath(config, 'API_PREFIX', 'api'),
    API_VERSION: stringValue(config, 'API_VERSION', '1').trim(),
    SOCKET_PATH: `/${normalizePath(config, 'SOCKET_PATH', 'socket.io')}`,
    CORS_ORIGINS: corsOrigins.join(','),
    TRUST_PROXY: stringValue(config, 'TRUST_PROXY', 'loopback').trim(),
    SWAGGER_ENABLED: swaggerEnabled,
    THROTTLE_ENABLED: throttleEnabled,
    SWAGGER_PATH: normalizePath(config, 'SWAGGER_PATH', 'api/docs'),
    BODY_LIMIT: bodyLimit,
    HTTP_THROTTLE_TTL_MS: integer(
      config,
      'HTTP_THROTTLE_TTL_MS',
      60_000,
      1_000,
      3_600_000,
    ),
    HTTP_THROTTLE_LIMIT: integer(
      config,
      'HTTP_THROTTLE_LIMIT',
      120,
      1,
      100_000,
    ),
    WS_THROTTLE_TTL_MS: integer(
      config,
      'WS_THROTTLE_TTL_MS',
      10_000,
      1_000,
      3_600_000,
    ),
    WS_THROTTLE_LIMIT: integer(config, 'WS_THROTTLE_LIMIT', 30, 1, 100_000),
    MAX_IMAGES: integer(config, 'MAX_IMAGES', 5, 1, 20),
    MAX_CHAT_ATTACHMENTS: integer(config, 'MAX_CHAT_ATTACHMENTS', 5, 1, 20),
    MAX_CHAT_ATTACHMENT_SIZE_BYTES: integer(
      config,
      'MAX_CHAT_ATTACHMENT_SIZE_BYTES',
      15_728_640,
      1_024,
      104_857_600,
    ),
    MAX_FILE_SIZE: integer(
      config,
      'MAX_FILE_SIZE',
      52_428_800,
      1_024,
      104_857_600,
    ),
    SMTP_PORT: integer(config, 'SMTP_PORT', 587, 1, 65_535),
    SMTP_SECURE: boolean(config, 'SMTP_SECURE', false),
    MONGODB_URI: mongodbUri,
    JWT_SECRET: jwtSecret,
    REDIS_URL: stringValue(
      config,
      'REDIS_URL',
      'redis://127.0.0.1:16379',
    ).trim(),
  };
}
