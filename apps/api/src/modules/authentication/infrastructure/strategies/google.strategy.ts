import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { CookiePkceStateStore } from './oauth-cookie-state.store';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { RedisKeyService } from '../../../../infrastructure/redis/redis-key.service';
import type { GooglePrincipal } from '../../application/ports/oauth-mobile-handoff.port';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    redis: RedisService,
    keys: RedisKeyService,
  ) {
    const secret =
      config.get<string>('OAUTH_STATE_ENCRYPTION_SECRET') ||
      config.getOrThrow<string>('JWT_SECRET');
    const oauthPath = `/${config.getOrThrow<string>('API_PREFIX')}/v${config.getOrThrow<string>('API_VERSION')}/auth/oauth/google`;
    super({
      clientID:
        config.get<string>('GOOGLE_OAUTH_CLIENT_ID') || 'disabled-client-id',
      clientSecret:
        config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET') ||
        'disabled-client-secret',
      callbackURL:
        config.get<string>('GOOGLE_OAUTH_CALLBACK_URL') ||
        'http://localhost/disabled-google-oauth',
      scope: ['openid', 'profile', 'email'],
      state: true,
      pkce: 'S256',
      store: new CookiePkceStateStore(
        secret,
        ['staging', 'production'].includes(
          config.get<string>('NODE_ENV') ?? 'development',
        ),
        redis,
        keys,
        oauthPath,
      ) as never,
    } as never);
  }

  override authorizationParams(): Record<string, string> {
    return { prompt: 'select_account' };
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): GooglePrincipal {
    // passport-google-oauth20 obtains this profile from Google's authenticated
    // userinfo endpoint. A mere email field is not treated as verification.
    const emailVerified =
      (profile as Profile & { _json?: { email_verified?: unknown } })._json
        ?.email_verified === true;
    return {
      provider: 'google',
      providerAccountId: profile.id,
      email: profile.emails?.[0]?.value?.toLowerCase(),
      emailVerified,
      displayName: profile.displayName,
    };
  }
}
