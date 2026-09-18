import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthMetricsService } from './health-metrics.service';
import { HealthMetricsController } from './health-metrics.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  HealthMetric,
  HealthMetricSchema,
} from './entities/health-metric.entity';
import { UsersModule } from '../users/users.module';
import { HEALTH_PROFILE_READER } from './ports/health-profile-reader';

@Module({
  imports: [
    NotificationsModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: HealthMetric.name, schema: HealthMetricSchema },
    ]),
  ],
  controllers: [HealthMetricsController],
  providers: [HealthMetricsService, { provide: HEALTH_PROFILE_READER, useExisting: HealthMetricsService }],
  exports: [HealthMetricsService, HEALTH_PROFILE_READER],
})
export class HealthMetricsModule {}
