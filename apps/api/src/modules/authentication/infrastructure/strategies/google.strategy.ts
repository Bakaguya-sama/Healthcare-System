import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { CookiePkceStateStore } from './oauth-cookie-state.store';

export type GooglePrincipal = {
  provider: 'google';
  providerAccountId: string;
  email?: string;
  displayName?: string;
};
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
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
        config.get<string>('NODE_ENV') === 'production',
        oauthPath,
      ) as never,
    } as never);
  }
  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): GooglePrincipal {
    return {
      provider: 'google',
      providerAccountId: profile.id,
      email: profile.emails?.[0]?.value?.toLowerCase(),
      displayName: profile.displayName,
    };
  }
}
