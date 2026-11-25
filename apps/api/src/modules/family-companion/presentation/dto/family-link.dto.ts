import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const FAMILY_PERMISSIONS = [
  'missed_task_reminder',
  'weekly_progress',
] as const;
export type FamilyPermissionName = (typeof FAMILY_PERMISSIONS)[number];

export class CreateFamilyLinkDto {
  @ApiPropertyOptional({
    description: 'ID of the Patient selected from the user contact search',
  })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  contactUserId?: string;
  @ApiPropertyOptional({
    description: 'Use true only for an unclaimed share invitation',
  })
  @IsOptional()
  @IsBoolean()
  share?: boolean;
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  relationship?: string;
}

export class RedeemFamilyInvitationDto {
  @ApiPropertyOptional({ maxLength: 256 })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  invitationToken?: string;
  @ApiPropertyOptional({ minLength: 6, maxLength: 6 })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  shortCode?: string;
}

export class AcceptFamilyInvitationDto {
  @ApiProperty({ maxLength: 64 })
  @IsString()
  @MaxLength(64)
  consentVersion!: string;
  @ApiProperty({ enum: FAMILY_PERMISSIONS, isArray: true })
  @IsIn(FAMILY_PERMISSIONS, { each: true })
  permissions!: FamilyPermissionName[];
}

export class FamilyLinkActionDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  reason?: string;
}

export class UpdateFamilyPermissionsDto {
  @ApiProperty({ enum: FAMILY_PERMISSIONS, isArray: true })
  @IsIn(FAMILY_PERMISSIONS, { each: true })
  permissions!: FamilyPermissionName[];
  @ApiProperty({ maxLength: 64 })
  @IsString()
  @MaxLength(64)
  policyVersion!: string;
}

export class FamilyLinksQueryDto {
  @ApiPropertyOptional({ enum: ['sent', 'received', 'all'], default: 'all' })
  @IsOptional()
  @IsIn(['sent', 'received', 'all'])
  direction: 'sent' | 'received' | 'all' = 'all';
  @ApiPropertyOptional({
    enum: ['pending', 'active', 'paused', 'declined', 'expired', 'revoked'],
  })
  @IsOptional()
  @IsIn(['pending', 'active', 'paused', 'declined', 'expired', 'revoked'])
  status?: string;
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;
  @ApiPropertyOptional({ minimum: 1, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit = 20;
}
