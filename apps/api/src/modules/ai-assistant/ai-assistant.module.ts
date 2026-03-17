import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantController } from './ai-assistant.controller';
import {
  AiConversation,
  AiConversationSchema,
} from './entities/ai-conversation.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiConversation.name, schema: AiConversationSchema },
    ]),
  ],
  controllers: [AiAssistantController],
  providers: [AiAssistantService],
})
export class AiAssistantModule {}
