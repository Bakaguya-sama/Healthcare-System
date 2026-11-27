import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { SpecialtyCatalogRepository } from '../../application/ports/care-directory.ports';
import { MedicalSpecialtyAggregate } from '../../domain/entities/medical-specialty.aggregate';
import { FacilityCommandTransaction } from './facility-command-transaction';
import {
  MedicalSpecialty,
  MedicalSpecialtyDocument,
} from './medical-specialty.schema';
import {
  DiseaseSpecialtyMapping,
  DiseaseSpecialtyMappingDocument,
} from './disease-specialty-mapping.schema';
import {
  MedicalFacility,
  MedicalFacilityDocument,
} from './medical-facility.schema';

@Injectable()
export class MongooseSpecialtyCatalogRepository implements SpecialtyCatalogRepository {
  constructor(
    @InjectModel(MedicalSpecialty.name)
    private readonly specialties: Model<MedicalSpecialtyDocument>,
    @InjectModel(DiseaseSpecialtyMapping.name)
    private readonly mappings: Model<DiseaseSpecialtyMappingDocument>,
    @InjectModel(MedicalFacility.name)
    private readonly facilities: Model<MedicalFacilityDocument>,
    private readonly commands: FacilityCommandTransaction,
  ) {}

  async listAdminSpecialties(input: { status?: string }) {
    const filter = input.status ? { status: input.status } : {};
    const rows = await this.specialties
      .find(filter)
      .select('code nameVi synonyms status revision')
      .sort({ nameVi: 1, code: 1 })
      .lean()
      .exec();
    return rows.map((row) => ({
      code: row.code,
      nameVi: row.nameVi,
      synonyms: row.synonyms ?? [],
      status: row.status,
      revision: row.revision,
    }));
  }

  createSpecialty(input: {
    code: string;
    nameVi: string;
    synonyms: string[];
    actorId: string;
    key: string;
  }) {
    return this.run(
      input,
      'specialty.create',
      { code: input.code, nameVi: input.nameVi, synonyms: input.synonyms },
      async (session) => {
        if (
          await this.specialties.exists({ code: input.code }).session(session)
        )
          throw new ConflictException('SPECIALTY_DUPLICATE');
        const [row] = await this.specialties.create(
          [
            {
              code: input.code,
              nameVi: input.nameVi,
              synonyms: input.synonyms,
              status: 'active',
              revision: 1,
              createdBy: new Types.ObjectId(input.actorId),
            },
          ],
          { session },
        );
        return {
          result: this.toRecord(row),
          audits: [
            {
              entityType: 'MedicalSpecialty',
              action: 'specialty_created',
              metadata: { code: row.code, revision: row.revision },
            },
          ],
        };
      },
    );
  }

  updateSpecialty(input: {
    code: string;
    nameVi: string;
    synonyms: string[];
    expectedRevision: number;
    actorId: string;
    key: string;
  }) {
    return this.run(
      input,
      'specialty.update',
      {
        code: input.code,
        nameVi: input.nameVi,
        synonyms: input.synonyms,
        expectedRevision: input.expectedRevision,
      },
      async (session) => {
        const current = await this.specialties
          .findOne({ code: input.code })
          .session(session)
          .exec();
        if (!current) throw new ConflictException('SPECIALTY_NOT_FOUND');
        const transition = MedicalSpecialtyAggregate.update({
          current: this.toState(current),
          expectedRevision: input.expectedRevision,
          nameVi: input.nameVi,
          synonyms: input.synonyms,
          actorId: input.actorId,
        });
        const row = await this.specialties
          .findOneAndUpdate(
            {
              code: input.code,
              status: 'active',
              revision: input.expectedRevision,
            },
            {
              $set: {
                ...transition,
                updatedBy: new Types.ObjectId(transition.updatedBy),
              },
            },
            { returnDocument: 'after', session },
          )
          .exec();
        if (!row) {
          const exists = await this.specialties
            .exists({ code: input.code })
            .session(session);
          throw new ConflictException(
            exists ? 'SPECIALTY_REVISION_CONFLICT' : 'SPECIALTY_NOT_FOUND',
          );
        }
        return {
          result: this.toRecord(row),
          audits: [
            {
              entityType: 'MedicalSpecialty',
              action: 'specialty_updated',
              metadata: { code: row.code, revision: row.revision },
            },
          ],
        };
      },
    );
  }

  retireSpecialty(input: {
    code: string;
    reason: string;
    expectedRevision: number;
    actorId: string;
    key: string;
  }): Promise<{ retired: true }> {
    return this.run(
      input,
      'specialty.retire',
      {
        code: input.code,
        reason: input.reason,
        expectedRevision: input.expectedRevision,
      },
      async (session) => {
        const mappingUse = await this.mappings
          .exists({
            specialtyCodes: input.code,
            status: { $in: ['draft', 'published'] },
          })
          .session(session);
        const facilityUse = await this.facilities
          .exists({
            specialtyCodes: input.code,
            status: { $in: ['draft', 'verified'] },
          })
          .session(session);
        if (mappingUse || facilityUse)
          throw new ConflictException('SPECIALTY_IN_USE');
        const current = await this.specialties
          .findOne({ code: input.code })
          .session(session)
          .exec();
        if (!current) throw new ConflictException('SPECIALTY_NOT_FOUND');
        const transition = MedicalSpecialtyAggregate.retire({
          current: this.toState(current),
          expectedRevision: input.expectedRevision,
          actorId: input.actorId,
        });
        const row = await this.specialties
          .findOneAndUpdate(
            {
              code: input.code,
              status: 'active',
              revision: input.expectedRevision,
            },
            {
              $set: {
                ...transition,
                updatedBy: new Types.ObjectId(transition.updatedBy),
              },
            },
            { returnDocument: 'after', session },
          )
          .exec();
        if (!row) {
          const exists = await this.specialties
            .exists({ code: input.code })
            .session(session);
          throw new ConflictException(
            exists ? 'SPECIALTY_REVISION_CONFLICT' : 'SPECIALTY_NOT_FOUND',
          );
        }
        return {
          result: { retired: true as const },
          audits: [
            {
              entityType: 'MedicalSpecialty',
              action: 'specialty_retired',
              reason: input.reason,
              metadata: { code: row.code, revision: row.revision },
            },
          ],
        };
      },
    );
  }

  private run<T extends object>(
    input: { actorId: string; key: string },
    operation: string,
    request: unknown,
    work: (
      session: import('mongoose').ClientSession,
    ) => Promise<{
      result: T;
      audits: import('./facility-command-transaction').FacilityAuditDraft[];
    }>,
  ): Promise<T> {
    return this.commands.run({
      actorId: input.actorId,
      operation,
      key: input.key,
      request,
      work,
    });
  }
  private toRecord(row: MedicalSpecialtyDocument) {
    return {
      code: row.code,
      nameVi: row.nameVi,
      synonyms: row.synonyms ?? [],
      status: row.status,
      revision: row.revision,
    };
  }
  private toState(row: MedicalSpecialtyDocument) {
    return {
      code: row.code,
      nameVi: row.nameVi,
      synonyms: row.synonyms ?? [],
      status: row.status,
      revision: row.revision,
    };
  }
}
