import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FamilyReminderPermission } from '../../domain/policies/family-companion.policy';
import {
  FamilyPolicyError,
  normalizeReminderPermissions,
} from '../../domain/policies/family-companion.policy';
import {
  FAMILY_LINK_REPOSITORY,
  type FamilyLinkRepository,
} from '../ports/family-link.repository';
import {
  assertFamilyCompanionEnabled,
  assertFamilyIdempotencyKey,
  assertValidFamilyId,
} from './family-companion-command-guard';

export interface UpdateFamilyReminderPermissionsCommand {
  permissions: FamilyReminderPermission[];
  policyVersion: string;
}

@Injectable()
export class UpdateFamilyReminderPermissions {
  constructor(
    @Inject(FAMILY_LINK_REPOSITORY)
    private readonly invitations: FamilyLinkRepository,
    private readonly config: ConfigService,
  ) {}

  async execute(
    patientId: string,
    familyLinkId: string,
    command: UpdateFamilyReminderPermissionsCommand,
    idempotencyKey: string,
  ) {
    assertFamilyCompanionEnabled(this.config);
    assertValidFamilyId(patientId);
    assertValidFamilyId(familyLinkId);
    assertFamilyIdempotencyKey(idempotencyKey);
    if (!command.policyVersion?.trim()) {
      throw new BadRequestException('FAMILY_POLICY_VERSION_REQUIRED');
    }
    let permissions: FamilyReminderPermission[];
    try {
      permissions = normalizeReminderPermissions(command.permissions);
    } catch (error) {
      if (error instanceof FamilyPolicyError) {
        throw new BadRequestException(error.code);
      }
      throw error;
    }
    const data = await this.invitations.updatePermissions(
      patientId,
      familyLinkId,
      { permissions, policyVersion: command.policyVersion.trim() },
      idempotencyKey.trim(),
    );
    return { statusCode: 200, message: 'Family permissions updated', data };
  }
}
