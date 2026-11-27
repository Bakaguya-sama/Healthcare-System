import { CareDirectoryInvariantError } from './medical-facility.aggregate';

export interface MedicalSpecialtyState {
  code: string;
  nameVi: string;
  synonyms: string[];
  status: 'active' | 'retired';
  revision: number;
}

/** Canonical directory specialty lifecycle; Doctor profile strings are outside this aggregate. */
export class MedicalSpecialtyAggregate {
  static update(input: {
    current: MedicalSpecialtyState;
    expectedRevision: number;
    nameVi: string;
    synonyms: string[];
    actorId: string;
  }) {
    this.assertActiveRevision(input.current, input.expectedRevision);
    return {
      nameVi: input.nameVi,
      synonyms: input.synonyms,
      updatedBy: input.actorId,
      revision: input.current.revision + 1,
    };
  }

  static retire(input: {
    current: MedicalSpecialtyState;
    expectedRevision: number;
    actorId: string;
  }) {
    this.assertActiveRevision(input.current, input.expectedRevision);
    return {
      status: 'retired' as const,
      updatedBy: input.actorId,
      revision: input.current.revision + 1,
    };
  }

  private static assertActiveRevision(
    current: MedicalSpecialtyState,
    expectedRevision: number,
  ): void {
    if (current.revision !== expectedRevision)
      throw new CareDirectoryInvariantError('SPECIALTY_REVISION_CONFLICT');
    if (current.status !== 'active')
      throw new CareDirectoryInvariantError('SPECIALTY_STATE_CONFLICT');
  }
}
