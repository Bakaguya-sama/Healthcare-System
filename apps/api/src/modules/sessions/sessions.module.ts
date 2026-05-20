import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { Session, SessionSchema } from './entities/session.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { SessionsGateway } from './sessions.gateway';
import { JwtModule } from '@nestjs/jwt';
import { JwtModuleOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '30m',
        },
      }),
    }),
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
  ],
  controllers: [SessionsController],
  providers: [SessionsService, SessionsGateway],
})
export class SessionsModule {}
