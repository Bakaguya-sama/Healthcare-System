import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { FamilyHealthMetricPeriod } from '../../domain/policies/health-metric-period.policy';
import { MetricType } from '../../../health-tracking/public-api';

export class FamilyHealthMetricWindowResponseDto {
  @ApiProperty({
    enum: ['week', 'month', 'quarter', 'year', 'all', 'custom', 'legacy-range'],
  })
  period!: FamilyHealthMetricPeriod | 'legacy-range';

  @ApiPropertyOptional({ example: '2024-11-20' })
  anchor?: string;

  @ApiProperty({ example: 'Asia/Ho_Chi_Minh' })
  timeZone!: 'Asia/Ho_Chi_Minh';

  @ApiProperty({ nullable: true, example: '2024-11-17T17:00:00.000Z' })
  from!: string | null;

  @ApiProperty({ nullable: true, example: '2024-11-24T17:00:00.000Z' })
  to!: string | null;

  @ApiProperty({ example: '[start,end)' })
  boundary!: '[start,end)';
}

export class FamilyHealthMetricPointResponseDto {
  @ApiProperty({ enum: Object.values(MetricType) })
  metricType!: MetricType;

  @ApiProperty({ example: 'kg' })
  unit!: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  values!: Record<string, number>;

  @ApiProperty({ example: '2024-11-20T09:30:00.000Z' })
  recordedAt!: string;
}

export class FamilyHealthMetricTrendResponseDto {
  @ApiProperty({ example: 200 })
  statusCode!: number;

  @ApiProperty({ type: () => FamilyHealthMetricTrendDataResponseDto })
  data!: Record<string, unknown>;
}

export class FamilyHealthMetricTrendDataResponseDto {
  @ApiProperty({ type: FamilyHealthMetricPointResponseDto, isArray: true })
  items!: FamilyHealthMetricPointResponseDto[];

  @ApiProperty({ nullable: true, example: 'opaque-cursor' })
  nextCursor!: string | null;

  @ApiProperty({ type: FamilyHealthMetricWindowResponseDto })
  window!: FamilyHealthMetricWindowResponseDto;
}

export class FamilyHealthMetricSummaryResponseDto {
  @ApiProperty({ example: 200 })
  statusCode!: number;

  @ApiProperty({ type: () => FamilyHealthMetricSummaryDataResponseDto })
  data!: Record<string, unknown>;
}

export class FamilyHealthMetricSummaryDataResponseDto {
  @ApiProperty({ enum: Object.values(MetricType) })
  metricType!: MetricType;

  @ApiProperty({ example: 5 })
  count!: number;

  @ApiProperty({ example: 70.25 })
  average!: number;

  @ApiProperty({ example: 65 })
  minimum!: number;

  @ApiProperty({ example: 78 })
  maximum!: number;

  @ApiProperty({ type: FamilyHealthMetricPointResponseDto })
  latest!: FamilyHealthMetricPointResponseDto;

  @ApiProperty({ type: FamilyHealthMetricWindowResponseDto })
  window!: FamilyHealthMetricWindowResponseDto;
}
