import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleOAuthEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate() {
    if (this.config.get<boolean>('GOOGLE_OAUTH_ENABLED') !== true)
      throw new NotFoundException('OAuth provider is unavailable');
    return true;
  }
}
