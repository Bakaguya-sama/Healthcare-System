import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './application/services/auth.service';
import { AuthController } from './presentation/controllers/auth.controller';
import {
  AuthSession,
  AuthSessionSchema,
} from './domain/entities/auth-session.schema';
import {
  AuthEvent,
  AuthEventSchema,
} from './domain/entities/auth-event.schema';
import {
  OAuthIdentity,
  OAuthIdentitySchema,
} from './domain/entities/oauth-identity.schema';
import { EmailModule } from '../../infrastructure/email/email.module';
import { FilesModule } from '../../infrastructure/files/files.module';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
import { AuthEmailDeliveryService } from './infrastructure/email/auth-email-delivery.service';
import { GoogleStrategy } from './infrastructure/strategies/google.strategy';
import { OtpService } from './application/services/otp.service';
import { GoogleMobileOAuthService } from './application/services/google-mobile-oauth.service';
import { RedisOAuthMobileHandoffAdapter } from './infrastructure/adapters/redis-oauth-mobile-handoff.adapter';
import { OAUTH_MOBILE_HANDOFF_PORT } from './application/ports/oauth-mobile-handoff.port';
import { GoogleAccountEmailBackfillService } from './application/services/google-account-email-backfill.service';
import { MongooseGoogleAccountEmailMaintenanceAdapter } from './infrastructure/adapters/mongoose-google-account-email-maintenance.adapter';
import { GOOGLE_ACCOUNT_EMAIL_MAINTENANCE_PORT } from './application/ports/google-account-email-maintenance.port';
import { GoogleOAuthEnabledGuard } from './presentation/guards/google-oauth-enabled.guard';
import { MongooseGooglePatientAccountRepository } from './infrastructure/adapters/mongoose-google-patient-account.repository';
import { GOOGLE_PATIENT_ACCOUNT_REPOSITORY } from './application/ports/google-patient-account.repository.port';
import { GOOGLE_OAUTH_AVAILABILITY_PORT } from './application/ports/google-oauth-availability.port';
import { ConfigGoogleOAuthAvailabilityAdapter } from './infrastructure/adapters/config-google-oauth-availability.adapter';

@Global()
@Module({
  imports: [
    ConfigModule,
    EmailModule,
    FilesModule,
    UsersModule,
    OutboxModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30m' },
      }),
    }),
    MongooseModule.forFeature([
      { name: AuthSession.name, schema: AuthSessionSchema },
      { name: AuthEvent.name, schema: AuthEventSchema },
      { name: OAuthIdentity.name, schema: OAuthIdentitySchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleOAuthEnabledGuard,
    OtpService,
    GoogleMobileOAuthService,
    RedisOAuthMobileHandoffAdapter,
    ConfigGoogleOAuthAvailabilityAdapter,
    {
      provide: GOOGLE_OAUTH_AVAILABILITY_PORT,
      useExisting: ConfigGoogleOAuthAvailabilityAdapter,
    },
    {
      provide: OAUTH_MOBILE_HANDOFF_PORT,
      useExisting: RedisOAuthMobileHandoffAdapter,
    },
    GoogleAccountEmailBackfillService,
    MongooseGoogleAccountEmailMaintenanceAdapter,
    {
      provide: GOOGLE_ACCOUNT_EMAIL_MAINTENANCE_PORT,
      useExisting: MongooseGoogleAccountEmailMaintenanceAdapter,
    },
    MongooseGooglePatientAccountRepository,
    {
      provide: GOOGLE_PATIENT_ACCOUNT_REPOSITORY,
      useExisting: MongooseGooglePatientAccountRepository,
    },
    JwtStrategy,
    GoogleStrategy,
    AuthEmailDeliveryService,
  ],
  exports: [
    JwtModule,
    PassportModule,
    AuthEmailDeliveryService,
    OtpService,
    GoogleMobileOAuthService,
    GoogleAccountEmailBackfillService,
  ],
})
export class AuthenticationModule {}
