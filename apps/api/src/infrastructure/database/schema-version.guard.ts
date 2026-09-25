import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

@Injectable()
export class SchemaVersionGuard implements OnApplicationBootstrap {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const minimum = this.config.getOrThrow<number>('MIN_SCHEMA_VERSION');
    if (minimum === 0) return;

    const latest = await this.connection.db
      ?.collection<{ version: number; status: string }>('_schema_migrations')
      .find({ status: 'applied' })
      .sort({ version: -1 })
      .limit(1)
      .next();
    const current = latest?.version ?? 0;

    if (current < minimum) {
      throw new Error(
        `Database schema version ${current} is below MIN_SCHEMA_VERSION ${minimum}; run database:migrate`,
      );
    }
  }
}
