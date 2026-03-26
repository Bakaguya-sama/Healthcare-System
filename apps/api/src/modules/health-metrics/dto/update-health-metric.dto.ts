import { PartialType } from '@nestjs/mapped-types';
import { CreateHealthMetricDto } from './create-health-metric.dto';

export class UpdateHealthMetricDto extends PartialType(CreateHealthMetricDto) {}
