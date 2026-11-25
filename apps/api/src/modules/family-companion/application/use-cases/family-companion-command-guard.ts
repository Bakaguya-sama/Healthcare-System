import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

export function assertFamilyCompanionEnabled(config: ConfigService) {
  if (config.get<boolean>('FAMILY_COMPANION_ENABLED') !== true) {
    throw new ForbiddenException('FAMILY_COMPANION_DISABLED');
  }
}

export function assertValidFamilyId(id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) {
    throw new BadRequestException('INVALID_ID');
  }
}

export function assertFamilyIdempotencyKey(key: string) {
  if (!key?.trim()) {
    throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');
  }
}
