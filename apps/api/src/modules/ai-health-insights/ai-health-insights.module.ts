import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiHealthInsight, AiHealthInsightSchema } from './entities/ai-health-insight.entity';
import { AiHealthInsightsService } from './services/ai-health-insights.service';
import { AiHealthInsightsController } from './controllers/ai-health-insights.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: AiHealthInsight.name,
        schema: AiHealthInsightSchema,
      },
    ]),
  ],
  controllers: [AiHealthInsightsController],
  providers: [AiHealthInsightsService],
  exports: [AiHealthInsightsService],
})
export class AiHealthInsightsModule {}
