import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiFeedbacksService } from './ai-feedbacks.service';
import { AiFeedbacksController } from './ai-feedbacks.controller';
import { AiFeedback, AiFeedbackSchema } from './entities/ai-feedback.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiFeedback.name, schema: AiFeedbackSchema },
    ]),
  ],
  controllers: [AiFeedbacksController],
  providers: [AiFeedbacksService],
  exports: [AiFeedbacksService],
})
export class AiFeedbacksModule {}
