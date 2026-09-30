import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCareProgramDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) programCode: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) diseaseKey: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() eligibilityForm?: Record<
    string,
    unknown
  >;
  @ApiProperty({
    example: {
      schemaVersion: 'v1',
      fields: [
        {
          key: 'systolic_bp',
          type: 'integer',
          unit: 'mmHg',
          range: { min: 70, max: 250 },
          required: true,
          visibility: 'care_team',
        },
      ],
    },
  })
  @IsObject()
  baselineForm: Record<string, unknown>;
  @ApiProperty({ type: [Object] }) @IsArray() taskTemplates: Record<
    string,
    unknown
  >[];
  @ApiProperty() @IsObject() reminderPolicy: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsObject() reviewPolicy?: Record<
    string,
    unknown
  >;
  @ApiPropertyOptional() @IsOptional() @IsObject() completionCriteria?: Record<
    string,
    unknown
  >;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  doctorEditableFields?: string[];
  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  contentJourney?: Record<string, unknown>[];
  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  dataSources?: Record<string, unknown>[];
}

export class UpdateCareProgramDto extends PartialType(CreateCareProgramDto) {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision: number;
}

export class CreateCareRuleDto {
  @ApiProperty({ type: [Object] }) @IsArray() rules: Record<string, unknown>[];
  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  dataSources?: Record<string, unknown>[];
  @ApiPropertyOptional() @IsOptional() @IsObject() testResults?: Record<
    string,
    unknown
  >;
}

export class UpdateCareRuleDto extends PartialType(CreateCareRuleDto) {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision: number;
}

export class LifecycleReasonDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision: number;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) reason: string;
}
