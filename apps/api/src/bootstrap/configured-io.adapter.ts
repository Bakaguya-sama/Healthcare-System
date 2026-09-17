import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

export class ConfiguredIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly config: ConfigService,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: Partial<ServerOptions>): unknown {
    const origins = this.config.getOrThrow<string>('CORS_ORIGINS').split(',');
    return super.createIOServer(port, {
      ...options,
      path: this.config.getOrThrow<string>('SOCKET_PATH'),
      cors: { origin: origins, credentials: true },
    });
  }
}
