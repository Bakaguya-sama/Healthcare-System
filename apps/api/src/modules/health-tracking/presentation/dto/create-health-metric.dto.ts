import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  HealthMetricSource,
  MetricType,
} from '../../domain/entities/health-metric.entity';

const TYPE_KEYS: Record<MetricType, string[]> = {
  [MetricType.BLOOD_PRESSURE]: ['systolic', 'diastolic'],
  [MetricType.HEART_RATE]: ['value'],
  [MetricType.BLOOD_GLUCOSE]: ['value'],
  [MetricType.OXYGEN_SATURATION]: ['value'],
  [MetricType.BODY_TEMPERATURE]: ['value'],
  [MetricType.RESPIRATORY_RATE]: ['value'],
  [MetricType.BMI]: ['value'],
  [MetricType.WEIGHT]: ['value'],
  [MetricType.HEIGHT]: ['value'],
  [MetricType.WATER_INTAKE]: ['amount'],
  [MetricType.KCAL_INTAKE]: ['amount'],
};

@ValidatorConstraint({ name: 'metricValuesConstraint', async: false })
export class MetricValuesConstraint implements ValidatorConstraintInterface {
  validate(values: unknown, args: ValidationArguments): boolean {
    if (!values || typeof values !== 'object' || Array.isArray(values))
      return false;
    const dto = args.object as { metricType?: MetricType };
    const requiredKeys = dto.metricType ? TYPE_KEYS[dto.metricType] : [];
    const entries = Object.entries(values as Record<string, unknown>);
    if (
      requiredKeys.length === 0 ||
      entries.length !== requiredKeys.length ||
      !entries.every(([key]) => requiredKeys.includes(key))
    )
      return false;
    return entries.every(
      ([, value]) =>
        typeof value === 'number' && Number.isFinite(value) && value >= 0,
    );
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as { metricType?: MetricType };
    const keys = dto.metricType ? TYPE_KEYS[dto.metricType] : [];
    return `values must contain exactly [${keys.join(', ')}] with finite non-negative numbers`;
  }
}

export class HealthMetricSourceRefDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  importBatchId?: string;
}

export class CreateHealthMetricDto {
  @ApiProperty({ enum: MetricType, example: MetricType.BLOOD_PRESSURE })
  @IsEnum(MetricType)
  metricType: MetricType;

  @ApiProperty({
    type: Object,
    example: { systolic: 120, diastolic: 80 },
    description: 'Canonical numeric values keyed by metric type',
  })
  @IsObject()
  @Validate(MetricValuesConstraint)
  values: Record<string, number>;

  @ApiProperty({ enum: HealthMetricSource, required: false })
  @IsOptional()
  @IsEnum(HealthMetricSource)
  source?: HealthMetricSource;

  @ApiProperty({ type: HealthMetricSourceRefDto, required: false })
  @IsOptional()
  @IsObject()
  sourceRef?: HealthMetricSourceRefDto;

  @ApiProperty({ example: 'Asia/Ho_Chi_Minh', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  recordedTimezone?: string;

  @ApiProperty({ example: '2026-03-16T20:30:00Z', required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  recordedAt?: Date;
}
