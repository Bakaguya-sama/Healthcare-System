import type { FamilyReminderPermission } from '../policies/family-companion.policy';

export interface FamilyPermissionSnapshot {
  policyVersion: string;
  permissions: FamilyReminderPermission[];
  grantedBy: string;
  grantedAt: Date;
}
