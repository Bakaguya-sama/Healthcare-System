import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthMetricsService } from './application/services/health-metrics.service';
import { HealthMetricsController } from './presentation/controllers/health-metrics.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  HealthMetric,
  HealthMetricSchema,
} from './domain/entities/health-metric.entity';
import { UsersModule } from '../users/users.module';
import { HEALTH_PROFILE } from './application/ports/health-profile.port';
import { HealthMetricQueryService } from './application/services/health-metric-query.service';
import { HealthMetricAlertService } from './application/services/health-metric-alert.service';
import { HEALTH_METRIC } from './application/ports/health-metric.port';

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
