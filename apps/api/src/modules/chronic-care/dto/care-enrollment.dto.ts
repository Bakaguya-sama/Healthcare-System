import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCareEnrollmentDto {
  @ApiProperty() @IsString() @IsNotEmpty() patientId: string;
  @ApiProperty() @IsString() @IsNotEmpty() programId: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(64) timezone: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() customSettings?: Record<
    string,
    unknown
  >;
}

export class ConsentDto {
  @ApiProperty() @IsString() @IsNotEmpty() policyVersion: string;
  @ApiProperty({ type: [String] }) purposes: string[];
}

export class BaselineDto {
  @ApiProperty({
    description:
      'Answers must match the baseline schema snapshot stored on the enrollment.',
  })
  @IsObject()
  answers: Record<string, unknown>;
}

export class EnrollmentReasonDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) expectedRevision: number;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) reason: string;
}
