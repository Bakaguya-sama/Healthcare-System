import type {
  FacilityDetails,
  FacilityDraftDetails,
  FacilityRevisionStatus,
  FacilityStatus,
} from '../care-directory.types';

export class CareDirectoryInvariantError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'CareDirectoryInvariantError';
  }
}

export interface MedicalFacilityState {
  id: string;
  status: FacilityStatus;
  revision: number;
  currentRevisionId?: string;
  draftRevisionId?: string;
}

export interface MedicalFacilityRevisionState {
  id: string;
  facilityId: string;
  version: number;
  revision: number;
  status: FacilityRevisionStatus;
  details: FacilityDraftDetails;
  createdBy?: string;
  updatedBy?: string;
  verifiedBy?: string;
  verifiedAt?: Date;
}

/** Pure lifecycle transitions for the Facility aggregate; persistence remains an infrastructure concern. */
export class MedicalFacilityAggregate {
  static createDraft(input: {
    id: string;
    revisionId: string;
    details: FacilityDraftDetails;
    actorId: string;
  }) {
    return {
      facility: {
        id: input.id,
        status: 'draft' as const,
        revision: 1,
        draftRevisionId: input.revisionId,
      },
      revision: {
        id: input.revisionId,
        facilityId: input.id,
        version: 1,
        revision: 1,
        status: 'draft' as const,
        details: input.details,
        createdBy: input.actorId,
      },
    };
  }

  static createDraftFromPlace(input: {
    id: string;
    revisionId: string;
    placeId: string;
    actorId: string;
  }) {
    return {
      facility: {
        id: input.id,
        status: 'draft' as const,
        revision: 1,
        draftRevisionId: input.revisionId,
        googlePlaceId: input.placeId,
      },
      revision: {
        id: input.revisionId,
        facilityId: input.id,
        version: 1,
        revision: 1,
        status: 'draft' as const,
        details: {},
        createdBy: input.actorId,
      },
    };
  }

  static updateDraft(input: {
    facility: MedicalFacilityState;
    revision: MedicalFacilityRevisionState;
    revisionId: string;
    expectedRevision: number;
    details: FacilityDraftDetails;
    actorId: string;
  }) {
    this.assertExpectedRevision(input.facility, input.expectedRevision);
    if (
      input.facility.status !== 'draft' &&
      input.facility.status !== 'verified'
    )
      throw new CareDirectoryInvariantError('FACILITY_STATE_CONFLICT');
    if (
      input.facility.draftRevisionId !== input.revisionId ||
      input.revision.id !== input.revisionId ||
      input.revision.status !== 'draft'
    )
      throw new CareDirectoryInvariantError('FACILITY_DRAFT_REVISION_CONFLICT');
    return {
      facility: { ...input.facility, revision: input.facility.revision + 1 },
      revision: {
        details: input.details,
        updatedBy: input.actorId,
        revision: input.revision.revision + 1,
      },
    };
  }

  static createRevision(input: {
    facility: MedicalFacilityState;
    currentDetails: FacilityDetails;
    revisionId: string;
    version: number;
    actorId: string;
  }) {
    if (
      input.facility.status !== 'verified' ||
      !input.facility.currentRevisionId ||
      input.facility.draftRevisionId
    )
      throw new CareDirectoryInvariantError('FACILITY_STATE_CONFLICT');
    return {
      facility: {
        ...input.facility,
        draftRevisionId: input.revisionId,
        revision: input.facility.revision + 1,
      },
      revision: {
        id: input.revisionId,
        facilityId: input.facility.id,
        version: input.version,
        revision: 1,
        status: 'draft' as const,
        details: input.currentDetails,
        createdBy: input.actorId,
      },
    };
  }

  static verifyRevision(input: {
    facility: MedicalFacilityState;
    revision: MedicalFacilityRevisionState;
    details: FacilityDetails;
    actorId: string;
    verifiedAt: Date;
  }) {
    if (
      input.facility.status !== 'draft' &&
      input.facility.status !== 'verified'
    )
      throw new CareDirectoryInvariantError('FACILITY_STATE_CONFLICT');
    if (
      input.facility.draftRevisionId !== input.revision.id ||
      input.revision.facilityId !== input.facility.id ||
      input.revision.status !== 'draft'
    )
      throw new CareDirectoryInvariantError('FACILITY_DRAFT_REVISION_CONFLICT');
    return {
      previousRevisionId: input.facility.currentRevisionId,
      facility: {
        ...input.facility,
        status: 'verified' as const,
        currentRevisionId: input.revision.id,
        draftRevisionId: undefined,
        revision: input.facility.revision + 1,
        verifiedBy: input.actorId,
        verifiedAt: input.verifiedAt,
        lastCheckedAt: input.verifiedAt,
        details: input.details,
      },
      revision: {
        status: 'verified' as const,
        details: input.details,
        verifiedBy: input.actorId,
        verifiedAt: input.verifiedAt,
      },
    };
  }

  static retire(input: {
    facility: MedicalFacilityState;
    expectedRevision: number;
    actorId: string;
    retiredAt: Date;
  }) {
    this.assertExpectedRevision(input.facility, input.expectedRevision);
    if (
      input.facility.status !== 'draft' &&
      input.facility.status !== 'verified'
    )
      throw new CareDirectoryInvariantError('FACILITY_STATE_CONFLICT');
    return {
      supersededDraftRevisionId: input.facility.draftRevisionId,
      facility: {
        ...input.facility,
        status: 'retired' as const,
        retiredBy: input.actorId,
        retiredAt: input.retiredAt,
        draftRevisionId: undefined,
        revision: input.facility.revision + 1,
      },
    };
  }

  private static assertExpectedRevision(
    facility: MedicalFacilityState,
    expectedRevision: number,
  ): void {
    if (facility.revision !== expectedRevision)
      throw new CareDirectoryInvariantError('FACILITY_REVISION_CONFLICT');
  }
}
