import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CARE_DIRECTORY_PROGRAM_CATALOG,
  CARE_DIRECTORY_QUERY_REPOSITORY,
  DISEASE_SPECIALTY_MAPPING_REPOSITORY,
  FACILITY_ADMIN_AUTHORITY,
  type CareDirectoryProgramCatalog,
  type CareDirectoryQueryRepository,
  type DiseaseSpecialtyMappingRepository,
  type FacilityAdminAuthority,
} from '../ports/care-directory.ports';
import type { MappingScope } from '../../domain/care-directory.types';
import { validateMapping } from '../../domain/policies/mapping-policy';

@Injectable()
export class ManageDiseaseSpecialtyMappings {
  constructor(
    @Inject(DISEASE_SPECIALTY_MAPPING_REPOSITORY)
    private readonly directory: DiseaseSpecialtyMappingRepository,
    @Inject(CARE_DIRECTORY_QUERY_REPOSITORY)
    private readonly queries: CareDirectoryQueryRepository,
    @Inject(CARE_DIRECTORY_PROGRAM_CATALOG)
    private readonly programs: CareDirectoryProgramCatalog,
    @Inject(FACILITY_ADMIN_AUTHORITY)
    private readonly admins: FacilityAdminAuthority,
  ) {}
  async list(
    actorId: string,
    query: { scope?: MappingScope; scopeKey?: string; status?: string },
  ) {
    await this.assertSuperAdmin(actorId);
    return { data: await this.directory.listMappings(query) };
  }
  async create(
    actorId: string,
    key: string,
    input: {
      scope: MappingScope;
      scopeKey: string;
      specialtyCodes: string[];
      sourceReferences: string[];
    },
  ) {
    await this.assertSuperAdmin(actorId);
    this.assertKey(key);
    const scopeKey = input.scopeKey.trim().toLowerCase();
    try {
      validateMapping(input.scope, scopeKey, input.specialtyCodes);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'MAPPING_INPUT_INVALID',
      );
    }
    await this.assertScopeExists(input.scope, scopeKey);
    await this.assertSpecialties(input.specialtyCodes);
    const sources = this.validateSources(input.sourceReferences);
    try {
      return {
        data: await this.directory.createMapping({
          scope: input.scope,
          scopeKey,
          specialtyCodes: this.normalizeCodes(input.specialtyCodes),
          sourceReferences: sources,
          actorId,
          key,
        }),
      };
    } catch (error) {
      this.mapError(error);
    }
  }
  async update(
    actorId: string,
    key: string,
    id: string,
    input: {
      specialtyCodes: string[];
      sourceReferences: string[];
      expectedRevision: number;
    },
  ) {
    await this.assertSuperAdmin(actorId);
    this.assertKey(key);
    this.assertRevision(input.expectedRevision);
    try {
      validateMapping('disease', 'valid-key', input.specialtyCodes);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'MAPPING_INPUT_INVALID',
      );
    }
    await this.assertSpecialties(input.specialtyCodes);
    try {
      return {
        data: await this.directory.updateMapping({
          id,
          specialtyCodes: this.normalizeCodes(input.specialtyCodes),
          sourceReferences: this.validateSources(input.sourceReferences),
          expectedRevision: input.expectedRevision,
          actorId,
          key,
        }),
      };
    } catch (error) {
      this.mapError(error);
    }
  }
  async publish(
    actorId: string,
    key: string,
    id: string,
    expectedRevision: number,
  ) {
    await this.assertSuperAdmin(actorId);
    this.assertKey(key);
    this.assertRevision(expectedRevision);
    try {
      return {
        data: await this.directory.publishMapping({
          id,
          expectedRevision,
          actorId,
          key,
        }),
      };
    } catch (error) {
      this.mapError(error);
    }
  }
  async retire(
    actorId: string,
    key: string,
    id: string,
    input: { reason: string; expectedRevision: number },
  ) {
    await this.assertSuperAdmin(actorId);
    this.assertKey(key);
    this.assertRevision(input.expectedRevision);
    if (!input.reason.trim() || input.reason.length > 300)
      throw new BadRequestException('MAPPING_RETIRE_REASON_REQUIRED');
    try {
      await this.directory.retireMapping({
        id,
        reason: input.reason.trim(),
        expectedRevision: input.expectedRevision,
        actorId,
        key,
      });
      return { data: { retired: true } };
    } catch (error) {
      this.mapError(error);
    }
  }
  private async assertScopeExists(scope: MappingScope, key: string) {
    const exists =
      scope === 'program'
        ? Boolean(await this.programs.findPublishedProgram(key))
        : await this.programs.hasPublishedProgramForDisease(key);
    if (!exists)
      throw new NotFoundException(
        scope === 'program'
          ? 'PUBLISHED_PROGRAM_NOT_FOUND'
          : 'PUBLISHED_DISEASE_NOT_FOUND',
      );
  }
  private async assertSpecialties(codes: string[]) {
    const found = await Promise.all(
      codes.map((code) => this.queries.getActiveSpecialty(code.toLowerCase())),
    );
    if (found.some((item) => !item))
      throw new BadRequestException('MAPPING_SPECIALTY_NOT_ACTIVE');
  }
  private validateSources(values: string[]) {
    if (!values?.length || values.length > 10)
      throw new BadRequestException('MAPPING_SOURCE_REQUIRED');
    const sources = [...new Set(values.map((value) => value.trim()))];
    if (
      sources.some(
        (value) => !/^https:\/\//i.test(value) || value.length > 1000,
      )
    )
      throw new BadRequestException('MAPPING_SOURCE_INVALID');
    return sources;
  }
  private normalizeCodes(values: string[]) {
    return [
      ...new Set(values.map((value) => value.trim().toLowerCase())),
    ].sort();
  }
  private async assertSuperAdmin(actorId: string) {
    if (!(await this.admins.isSuperAdmin(actorId)))
      throw new ForbiddenException('SUPER_ADMIN_REQUIRED');
  }
  private assertKey(key: string) {
    if (!key || key.length < 16 || key.length > 128)
      throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');
  }
  private assertRevision(revision: number) {
    if (!Number.isInteger(revision) || revision < 1)
      throw new BadRequestException('EXPECTED_REVISION_REQUIRED');
  }
  private mapError(error: unknown): never {
    if (error instanceof Error) {
      if (error.message === 'MAPPING_NOT_FOUND')
        throw new NotFoundException(error.message);
      if (error.message === 'PUBLISHED_MAPPING_CONFLICT')
        throw new ConflictException(error.message);
      if (
        error.message.startsWith('MAPPING_') ||
        error.message === 'EXPECTED_REVISION_CONFLICT'
      )
        throw new ConflictException(error.message);
    }
    throw error;
  }
}
