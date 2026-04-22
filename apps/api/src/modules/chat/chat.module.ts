import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { Message, MessageSchema } from './entities/message.entity';
import { Session, SessionSchema } from '../sessions/entities/session.entity';
import { CloudinaryService } from '../../core/services/cloudinary.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, CloudinaryService],
})
export class ChatModule {}
