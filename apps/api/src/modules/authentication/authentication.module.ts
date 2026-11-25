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
import { OAuthHandoffService } from './application/services/oauth-handoff.service';

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
    OtpService,
    OAuthHandoffService,
    JwtStrategy,
    GoogleStrategy,
    AuthEmailDeliveryService,
  ],
  exports: [
    JwtModule,
    PassportModule,
    AuthEmailDeliveryService,
    OtpService,
    OAuthHandoffService,
  ],
})
export class AuthenticationModule {}
