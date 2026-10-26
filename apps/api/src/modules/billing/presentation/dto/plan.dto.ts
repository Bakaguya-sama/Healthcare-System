import { IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
export class CreatePlanDraftDto {
  @IsString() @IsNotEmpty() @MaxLength(32) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsInt() @Min(0) price!: number; @IsString() @IsOptional() currency = 'VND';
  @IsInt() @Min(1) @Max(366) durationDays!: number;
  @IsInt() @Min(0) aiRequestLimit!: number; @IsInt() @Min(0) aiTokenLimit!: number;
  @IsIn(['day', 'subscription_cycle']) aiQuotaPeriod!: 'day' | 'subscription_cycle';
  @IsInt() @Min(0) consultationLimitPerCycle!: number; @IsInt() @Min(0) @Max(100) activeCareProgramLimit!: number;
  @IsObject() benefits!: Record<string, unknown>; @IsObject() refundPolicy!: Record<string, unknown>;
}
