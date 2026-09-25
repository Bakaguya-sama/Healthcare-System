import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthSession, AuthSessionSchema } from './entities/auth-session.schema';
import { AuthEvent, AuthEventSchema } from './entities/auth-event.schema';
import { OtpService } from './otp.service';
import { EmailModule } from '../../infrastructure/email/email.module';
import { FilesModule } from '../../infrastructure/files/files.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    EmailModule,
    FilesModule,
    UsersModule,
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
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, JwtStrategy],
  exports: [JwtModule, PassportModule],
})
export class AuthenticationModule {}
