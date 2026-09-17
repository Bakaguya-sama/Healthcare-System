import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class ProxyThrottlerGuard extends ThrottlerGuard {
  @Inject(ConfigService)
  private readonly runtimeConfig!: ConfigService;

  canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.runtimeConfig.getOrThrow<boolean>('THROTTLE_ENABLED')) {
      return Promise.resolve(true);
    }
    return super.canActivate(context);
  }

  protected getTracker(request: Request): Promise<string> {
    return Promise.resolve(request.ips[0] ?? request.ip ?? 'unknown');
  }
}
