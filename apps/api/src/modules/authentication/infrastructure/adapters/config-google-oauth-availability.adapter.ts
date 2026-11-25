import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GoogleOAuthAvailabilityPort } from '../../application/ports/google-oauth-availability.port';

@Injectable()
export class ConfigGoogleOAuthAvailabilityAdapter implements GoogleOAuthAvailabilityPort {
  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.config.get<boolean>('GOOGLE_OAUTH_ENABLED') === true;
  }
}
