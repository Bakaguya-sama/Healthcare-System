import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiSessionsService } from './ai-sessions.service';
import { AiSessionsController } from './ai-sessions.controller';
import { AiSession, AiSessionSchema } from './entities/ai-session.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiSession.name, schema: AiSessionSchema },
    ]),
  ],
  controllers: [AiSessionsController],
  providers: [AiSessionsService],
  exports: [AiSessionsService],
})
export class AiSessionsModule {}
