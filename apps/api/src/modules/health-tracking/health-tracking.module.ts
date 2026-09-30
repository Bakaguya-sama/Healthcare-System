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
import { HEALTH_PROFILE } from './ports/health-profile.port';
import { HealthMetricQueryService } from './health-metric-query.service';
import { HealthMetricAlertService } from './health-metric-alert.service';
import { HEALTH_METRIC } from './ports/health-metric.port';

@Module({
  imports: [
    NotificationsModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: HealthMetric.name, schema: HealthMetricSchema },
    ]),
  ],
  controllers: [HealthMetricsController],
  providers: [
    HealthMetricsService,
    HealthMetricQueryService,
    HealthMetricAlertService,
    { provide: HEALTH_PROFILE, useExisting: HealthMetricQueryService },
    {
      provide: HEALTH_METRIC,
      useExisting: HealthMetricQueryService,
    },
  ],
  exports: [HealthMetricsService, HEALTH_PROFILE, HEALTH_METRIC],
})
export class HealthTrackingModule {}
