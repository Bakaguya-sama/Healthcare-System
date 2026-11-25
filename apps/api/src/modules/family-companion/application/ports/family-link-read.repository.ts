import type { FamilyLinkStatus } from '../../domain/policies/family-companion.policy';

export interface FamilyLinkReadModel {
  id: string;
  patientId: string;
  relationship?: string;
  status: FamilyLinkStatus;
  invitationVersion: number;
  invitationDelivery: string;
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

export interface FamilyLinkPage {
  items: FamilyLinkReadModel[];
  total: number;
}

export const FAMILY_LINK_READ_REPOSITORY = Symbol(
  'FAMILY_LINK_READ_REPOSITORY',
);

export interface FamilyLinkReadRepository {
  findParticipantPage(input: {
    userId: string;
    direction: 'sent' | 'received' | 'all';
    status?: string;
    page: number;
    limit: number;
  }): Promise<FamilyLinkPage>;
  findParticipantLink(
    userId: string,
    linkId: string,
  ): Promise<FamilyLinkReadModel | null>;
  findAdminPage(input: {
    status?: string;
    page: number;
    limit: number;
  }): Promise<FamilyLinkPage>;
}
