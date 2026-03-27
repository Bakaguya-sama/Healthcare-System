import {
  IsEnum,
  IsString,
  IsOptional,
  IsDate,
  IsObject,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { MetricType } from '../entities/health-metric.entity';

export class MetricValueEntryDto {
  @ApiProperty({ example: 120 })
  value: number;

  @ApiProperty({ example: '2026-03-16T08:00:00Z' })
  recordedAt: Date;
}

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
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return false;
    }

    const dto = args.object as CreateHealthMetricDto;
    const metricType = dto.type;
    const requiredKeys = TYPE_KEYS[metricType] || [];
    const valueKeys = Object.keys(values as Record<string, unknown>);

    if (requiredKeys.length > 0) {
      if (valueKeys.length !== requiredKeys.length) {
        return false;
      }
      const requiredSet = new Set(requiredKeys);
      if (!valueKeys.every((key) => requiredSet.has(key))) {
        return false;
      }
    }

    for (const detail of Object.values(values as Record<string, unknown>)) {
      if (!detail || typeof detail !== 'object' || Array.isArray(detail)) {
        return false;
      }

      const value = (detail as MetricValueEntryDto).value;
      const recordedAt = (detail as MetricValueEntryDto).recordedAt;

      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        return false;
      }

      const recordedDate = new Date(recordedAt);
      if (!recordedAt || Number.isNaN(recordedDate.getTime())) {
        return false;
      }
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as CreateHealthMetricDto;
    const requiredKeys = TYPE_KEYS[dto.type] || [];
    if (requiredKeys.length > 0) {
      return `values must contain exactly [${requiredKeys.join(', ')}], and each key must include { value: number, recordedAt: valid date }`;
    }
    return 'values must be an object with { value: number, recordedAt: valid date } entries';
  }
}

export class CreateHealthMetricDto {
  @ApiProperty({ enum: MetricType, example: 'blood_pressure' })
  @IsEnum(MetricType)
  type: MetricType;

  @ApiProperty({
    type: Object,
    example: {
      systolic: { value: 120, recordedAt: '2026-03-16T08:00:00Z' },
      diastolic: { value: 80, recordedAt: '2026-03-16T08:05:00Z' },
    },
    description:
      'Dynamic object by metric type. Each key must be { value: number, recordedAt: ISO date }',
  })
  @IsObject()
  @Validate(MetricValuesConstraint)
  values: Record<string, MetricValueEntryDto>;

  @ApiProperty({ example: 'mmHg', required: false })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiProperty({ example: '2026-03-16T20:30:00Z', required: false })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  recordedAt?: Date;
}
