import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OutboxEvent, OutboxEventSchema } from './entities/outbox-event.entity';
import { OutboxService } from './outbox.service';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OutboxEvent.name, schema: OutboxEventSchema },
    ]),
  ],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}
