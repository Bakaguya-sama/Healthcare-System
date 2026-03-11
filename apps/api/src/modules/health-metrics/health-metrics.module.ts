import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthMetricsService } from './health-metrics.service';
import { HealthMetricsController } from './health-metrics.controller';
import {
  HealthMetric,
  HealthMetricSchema,
} from './entities/health-metric.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HealthMetric.name, schema: HealthMetricSchema },
    ]),
  ],
  controllers: [HealthMetricsController],
  providers: [HealthMetricsService],
  exports: [HealthMetricsService],
})
export class HealthMetricsModule {}
