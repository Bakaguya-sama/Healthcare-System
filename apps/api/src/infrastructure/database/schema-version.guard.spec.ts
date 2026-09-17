import { ConfigService } from '@nestjs/config';
import type { Connection } from 'mongoose';
import { SchemaVersionGuard } from './schema-version.guard';

describe('SchemaVersionGuard', () => {
  it('rejects application bootstrap when the schema is below the minimum', async () => {
    const next = jest.fn().mockResolvedValue({ version: 9 });
    const connection = {
      db: {
        collection: () => ({
          find: () => ({
            sort: () => ({ limit: () => ({ next }) }),
          }),
        }),
      },
    } as unknown as Connection;
    const config = {
      getOrThrow: jest.fn(() => 10),
    } as unknown as ConfigService;

    await expect(
      new SchemaVersionGuard(connection, config).onApplicationBootstrap(),
    ).rejects.toThrow('below MIN_SCHEMA_VERSION');
  });

  it('allows an unpinned development schema version', async () => {
    const connection = {} as Connection;
    const config = {
      getOrThrow: jest.fn(() => 0),
    } as unknown as ConfigService;

    await expect(
      new SchemaVersionGuard(connection, config).onApplicationBootstrap(),
    ).resolves.toBeUndefined();
  });
});
