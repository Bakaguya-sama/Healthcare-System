import { CareDirectoryInvariantError } from './medical-facility.aggregate';
import type { MappingScope, MappingStatus } from '../care-directory.types';

export interface DiseaseSpecialtyMappingState {
  id: string;
  scope: MappingScope;
  scopeKey: string;
  version: number;
  revision: number;
  status: MappingStatus;
  specialtyCodes: string[];
  sourceReferences: string[];
}

/** Version and publish transitions for a Program/disease specialty mapping. */
export class DiseaseSpecialtyMappingAggregate {
  static createDraft(input: {
    id: string;
    scope: MappingScope;
    scopeKey: string;
    version: number;
    specialtyCodes: string[];
    sourceReferences: string[];
  }) {
    return { ...input, revision: 1, status: 'draft' as const };
  }

  static updateDraft(input: {
    current: DiseaseSpecialtyMappingState;
    expectedRevision: number;
    specialtyCodes: string[];
    sourceReferences: string[];
    actorId: string;
  }) {
    this.assertDraftRevision(input.current, input.expectedRevision);
    return {
      specialtyCodes: input.specialtyCodes,
      sourceReferences: input.sourceReferences,
      updatedBy: input.actorId,
      revision: input.current.revision + 1,
    };
  }

  static publish(input: {
    candidate: DiseaseSpecialtyMappingState;
    expectedRevision: number;
    previous?: DiseaseSpecialtyMappingState;
    actorId: string;
    publishedAt: Date;
  }) {
    this.assertDraftRevision(input.candidate, input.expectedRevision);
    if (
      input.previous &&
      (input.previous.scope !== input.candidate.scope ||
        input.previous.scopeKey !== input.candidate.scopeKey ||
        input.previous.status !== 'published')
    )
      throw new CareDirectoryInvariantError('MAPPING_PUBLISHED_SCOPE_CONFLICT');
    return {
      candidate: {
        status: 'published' as const,
        publishedBy: input.actorId,
        publishedAt: input.publishedAt,
        revision: input.candidate.revision + 1,
      },
      ...(input.previous
        ? {
            previous: {
              status: 'retired' as const,
              retiredBy: input.actorId,
              retiredAt: input.publishedAt,
              revision: input.previous.revision + 1,
            },
          }
        : {}),
    };
  }

  static retire(input: {
    current: DiseaseSpecialtyMappingState;
    expectedRevision: number;
    actorId: string;
    retiredAt: Date;
  }) {
    if (input.current.revision !== input.expectedRevision)
      throw new CareDirectoryInvariantError('MAPPING_REVISION_CONFLICT');
    if (
      input.current.status !== 'draft' &&
      input.current.status !== 'published'
    )
      throw new CareDirectoryInvariantError('MAPPING_STATE_CONFLICT');
    return {
      status: 'retired' as const,
      retiredBy: input.actorId,
      retiredAt: input.retiredAt,
      revision: input.current.revision + 1,
    };
  }

  private static assertDraftRevision(
    mapping: DiseaseSpecialtyMappingState,
    expectedRevision: number,
  ): void {
    if (mapping.revision !== expectedRevision)
      throw new CareDirectoryInvariantError('MAPPING_REVISION_CONFLICT');
    if (mapping.status !== 'draft')
      throw new CareDirectoryInvariantError('MAPPING_STATE_CONFLICT');
  }
}
