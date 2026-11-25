export const FAMILY_COMPANION_CONTACT_DIRECTORY = Symbol(
  'FAMILY_COMPANION_CONTACT_DIRECTORY',
);

export interface FamilyCompanionContactRecord {
  id: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
}

export interface FamilyCompanionContactSearch {
  items: FamilyCompanionContactRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FamilyCompanionContactDirectory {
  searchEligiblePatients(
    search: string,
    page: number,
    limit: number,
  ): Promise<FamilyCompanionContactSearch>;
}
