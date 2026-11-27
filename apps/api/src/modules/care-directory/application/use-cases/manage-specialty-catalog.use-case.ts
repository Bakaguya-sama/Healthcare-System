import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FACILITY_ADMIN_AUTHORITY,
  SPECIALTY_CATALOG_REPOSITORY,
  type SpecialtyCatalogRepository,
  type FacilityAdminAuthority,
} from '../ports/care-directory.ports';

@Injectable()
export class ManageSpecialtyCatalog {
  constructor(
    @Inject(SPECIALTY_CATALOG_REPOSITORY)
    private readonly directory: SpecialtyCatalogRepository,
    @Inject(FACILITY_ADMIN_AUTHORITY)
    private readonly admins: FacilityAdminAuthority,
  ) {}
  async list(actorId: string, status?: string) {
    await this.assertSuperAdmin(actorId);
    return { data: await this.directory.listAdminSpecialties({ status }) };
  }
  async create(
    actorId: string,
    key: string,
    input: { code: string; nameVi: string; synonyms?: string[] },
  ) {
    await this.assertSuperAdmin(actorId);
    this.assertKey(key);
    const code = input.code.trim().toLowerCase();
    if (
      !/^[a-z0-9][a-z0-9._-]{1,59}$/.test(code) ||
      input.nameVi.trim().length < 2
    )
      throw new BadRequestException('SPECIALTY_INPUT_INVALID');
    return {
      data: await this.directory.createSpecialty({
        code,
        nameVi: input.nameVi.trim(),
        synonyms: this.normalizeSynonyms(input.synonyms),
        actorId,
        key,
      }),
    };
  }
  async update(
    actorId: string,
    key: string,
    code: string,
    input: { nameVi: string; synonyms?: string[]; expectedRevision: number },
  ) {
    await this.assertSuperAdmin(actorId);
    this.assertKey(key);
    if (
      !Number.isInteger(input.expectedRevision) ||
      input.expectedRevision < 1 ||
      input.nameVi.trim().length < 2
    )
      throw new BadRequestException('SPECIALTY_INPUT_INVALID');
    try {
      return {
        data: await this.directory.updateSpecialty({
          code,
          nameVi: input.nameVi.trim(),
          synonyms: this.normalizeSynonyms(input.synonyms),
          expectedRevision: input.expectedRevision,
          actorId,
          key,
        }),
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'SPECIALTY_NOT_FOUND')
        throw new NotFoundException(error.message);
      if (
        error instanceof Error &&
        (error.message.includes('CONFLICT') ||
          error.message === 'SPECIALTY_IN_USE')
      )
        throw new ConflictException(error.message);
      if (error instanceof Error && error.message.startsWith('SPECIALTY_'))
        throw new BadRequestException(error.message);
      throw error;
    }
  }
  async retire(
    actorId: string,
    key: string,
    code: string,
    input: { reason: string; expectedRevision: number },
  ) {
    await this.assertSuperAdmin(actorId);
    this.assertKey(key);
    if (
      !input.reason.trim() ||
      input.reason.length > 300 ||
      input.expectedRevision < 1
    )
      throw new BadRequestException('SPECIALTY_RETIRE_INPUT_INVALID');
    try {
      await this.directory.retireSpecialty({
        code,
        reason: input.reason.trim(),
        expectedRevision: input.expectedRevision,
        actorId,
        key,
      });
      return { data: { retired: true } };
    } catch (error) {
      if (error instanceof Error && error.message === 'SPECIALTY_NOT_FOUND')
        throw new NotFoundException(error.message);
      if (
        error instanceof Error &&
        (error.message.includes('CONFLICT') ||
          error.message === 'SPECIALTY_IN_USE')
      )
        throw new ConflictException(error.message);
      if (error instanceof Error && error.message.startsWith('SPECIALTY_'))
        throw new BadRequestException(error.message);
      throw error;
    }
  }
  private async assertSuperAdmin(actorId: string) {
    if (!(await this.admins.isSuperAdmin(actorId)))
      throw new ForbiddenException('SUPER_ADMIN_REQUIRED');
  }
  private assertKey(key: string) {
    if (!key || key.length < 16 || key.length > 128)
      throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');
  }
  private normalizeSynonyms(values?: string[]) {
    const result = [
      ...new Set((values ?? []).map((item) => item.trim()).filter(Boolean)),
    ];
    if (result.some((item) => item.length > 100) || result.length > 30)
      throw new BadRequestException('SPECIALTY_SYNONYMS_INVALID');
    return result;
  }
}
