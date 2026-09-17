import { ConfigService } from '@nestjs/config';
import { RedisKeyService } from './redis-key.service';

describe('RedisKeyService', () => {
  const config = {
    getOrThrow: jest.fn(() => 'healthcare-test'),
  } as unknown as ConfigService;
  const keys = new RedisKeyService(config);

  it('builds namespaced keys and safely encodes IPv6 trackers', () => {
    expect(keys.build('throttle', 'socket', '::1', 'sendMessage')).toBe(
      'healthcare-test:throttle:socket:%3A%3A1:sendMessage',
    );
  });

  it('rejects empty key segments', () => {
    expect(() => keys.build('cache', ' ')).toThrow('non-empty');
  });
});
