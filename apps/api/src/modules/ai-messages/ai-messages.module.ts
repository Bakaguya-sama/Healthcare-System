import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiMessagesService } from './ai-messages.service';
import { AiMessagesController } from './ai-messages.controller';
import { AiMessage, AiMessageSchema } from './entities/ai-message.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiMessage.name, schema: AiMessageSchema },
    ]),
  ],
  controllers: [AiMessagesController],
  providers: [AiMessagesService],
  exports: [AiMessagesService],
})
export class AiMessagesModule {}
