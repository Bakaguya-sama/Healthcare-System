import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class ChangeFamilyHealthMetricSharingDto {
  @ApiPropertyOptional({ enum: ['all', 'selected'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'selected'])
  scope?: 'all' | 'selected';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metricTypes?: string[];

  @ApiProperty({ example: 'family-health-metric-sharing.v1' })
  @IsString()
  consentVersion!: string;
}
