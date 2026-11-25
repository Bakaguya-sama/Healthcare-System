import type { FamilyLinkStatus } from '../../domain/policies/family-companion.policy';

export const FAMILY_INVITATION_CREATION_STORE = Symbol(
  'FAMILY_INVITATION_CREATION_STORE',
);

export interface InvitationPatient {
  id: string;
  role: string;
  accountStatus: string;
  emailVerifiedAt?: Date | null;
}

export interface EligibleFamilyContact {
  id: string;
  role: string;
  accountStatus: string;
  emailVerifiedAt?: Date | null;
}

export interface InvitationEntitlement {
  subscriptionId?: string;
  familyLinkLimit: number;
}

export interface FamilyInvitationRecord {
  id: string;
  patientId: string;
  familyUserId?: string;
  relationship?: string;
  status: FamilyLinkStatus;
  invitationVersion: number;
  invitationDelivery: 'shared_link' | 'selected_contact';
  invitationExpiresAt: Date;
  shortCodeExpiresAt?: Date;
  permissions: string[];
  consentVersion?: string;
  invitedAt: Date;
  acceptedAt?: Date;
  pausedAt?: Date;
  resumedAt?: Date;
  declinedAt?: Date;
  expiredAt?: Date;
  revokedAt?: Date;
}

export interface SaveFamilyInvitationInput {
  reusableLinkId?: string;
  patientId: string;
  familyUserId?: string;
  relationship?: string;
  idempotencyKey: string;
  idempotencyRequestHash: string;
  invitationVersion: number;
  invitationDelivery: 'shared_link' | 'selected_contact';
  invitationTokenHash: string;
  shortCodeHash: string;
  shortCodeExpiresAt: Date;
  invitedAt: Date;
  invitationExpiresAt: Date;
  entitlementSubscriptionId?: string;
  entitlementFamilyLinkLimit: number;
}

export interface FamilyInvitationCreationStore {
  findPatient(patientId: string): Promise<InvitationPatient | null>;
  findEligibleContact(
    contactUserId: string,
  ): Promise<EligibleFamilyContact | null>;
  getEntitlement(patientId: string): Promise<InvitationEntitlement>;
  findByIdempotencyKey(
    patientId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<FamilyInvitationRecord | null>;
  countActiveLinks(patientId: string): Promise<number>;
  findOpenLink(
    patientId: string,
    familyUserId: string,
  ): Promise<FamilyInvitationRecord | null>;
  findReusableLink(
    patientId: string,
    familyUserId: string,
  ): Promise<FamilyInvitationRecord | null>;
  saveWithAuditAndOutbox(
    input: SaveFamilyInvitationInput,
  ): Promise<FamilyInvitationRecord>;
}
