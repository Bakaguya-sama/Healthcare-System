import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { DiseaseSpecialtyMappingRepository } from '../../application/ports/care-directory.ports';
import { DiseaseSpecialtyMappingAggregate, type DiseaseSpecialtyMappingState } from '../../domain/entities/disease-specialty-mapping.aggregate';
import { FacilityCommandTransaction } from './facility-command-transaction';
import { DiseaseSpecialtyMapping, DiseaseSpecialtyMappingDocument } from './disease-specialty-mapping.schema';
import { MedicalSpecialty, MedicalSpecialtyDocument } from './medical-specialty.schema';

@Injectable()
export class MongooseDiseaseSpecialtyMappingRepository implements DiseaseSpecialtyMappingRepository {
  constructor(
    @InjectModel(DiseaseSpecialtyMapping.name) private readonly mappings: Model<DiseaseSpecialtyMappingDocument>,
    @InjectModel(MedicalSpecialty.name) private readonly specialties: Model<MedicalSpecialtyDocument>,
    private readonly commands: FacilityCommandTransaction,
  ) {}

  async listMappings(input: { scope?: 'program' | 'disease'; scopeKey?: string; status?: string }) {
    const filter: Record<string, unknown> = {};
    if (input.scope) filter.scope = input.scope;
    if (input.scopeKey) filter.scopeKey = input.scopeKey.toLowerCase();
    if (input.status) filter.status = input.status;
    const rows = await this.mappings.find(filter).sort({ scope: 1, scopeKey: 1, version: -1 }).lean().exec();
    return rows.map((row) => this.toRecord(row));
  }

  createMapping(input: { scope: 'program' | 'disease'; scopeKey: string; specialtyCodes: string[]; sourceReferences: string[]; actorId: string; key: string }) {
    return this.run(input, 'mapping.create', input, async (session) => {
      await this.assertSpecialtiesActive(input.specialtyCodes, session);
      const previous = await this.mappings.findOne({ scope: input.scope, scopeKey: input.scopeKey }).sort({ version: -1 }).session(session).lean().exec();
      const version = (previous?.version ?? 0) + 1;
      const state = DiseaseSpecialtyMappingAggregate.createDraft({ id: String(new Types.ObjectId()), scope: input.scope, scopeKey: input.scopeKey, version, specialtyCodes: input.specialtyCodes, sourceReferences: input.sourceReferences });
      const [row] = await this.mappings.create([{ _id: new Types.ObjectId(state.id), scope: state.scope, scopeKey: state.scopeKey, version: state.version, revision: state.revision, status: state.status, specialtyCodes: state.specialtyCodes, sourceReferences: state.sourceReferences, createdBy: new Types.ObjectId(input.actorId) }], { session });
      return { result: this.toRecord(row), audits: [{ entityType: 'DiseaseSpecialtyMapping', entityId: String(row._id), action: 'specialty_mapping_draft_created', metadata: { scope: row.scope, scopeKey: row.scopeKey, version } }] };
    });
  }

  updateMapping(input: { id: string; specialtyCodes: string[]; sourceReferences: string[]; expectedRevision: number; actorId: string; key: string }) {
    return this.run(input, 'mapping.update', { id: input.id, specialtyCodes: input.specialtyCodes, sourceReferences: input.sourceReferences, expectedRevision: input.expectedRevision }, async (session) => {
      await this.assertSpecialtiesActive(input.specialtyCodes, session);
      const id = this.objectId(input.id);
      const current = await this.mappings.findOne({ _id: id }).session(session).exec();
      if (!current) throw new NotFoundException('MAPPING_NOT_FOUND');
      const transition = DiseaseSpecialtyMappingAggregate.updateDraft({ current: this.toState(current), expectedRevision: input.expectedRevision, specialtyCodes: input.specialtyCodes, sourceReferences: input.sourceReferences, actorId: input.actorId });
      const row = await this.mappings.findOneAndUpdate({ _id: id, status: 'draft', revision: input.expectedRevision }, { $set: { specialtyCodes: transition.specialtyCodes, sourceReferences: transition.sourceReferences, updatedBy: new Types.ObjectId(transition.updatedBy), revision: transition.revision } }, { returnDocument: 'after', session }).exec();
      if (!row) throw await this.notFoundOrConflict(this.mappings, id, session);
      return { result: this.toRecord(row), audits: [{ entityType: 'DiseaseSpecialtyMapping', entityId: String(id), action: 'specialty_mapping_draft_updated', metadata: { scope: row.scope, scopeKey: row.scopeKey, version: row.version, revision: row.revision } }] };
    });
  }

  publishMapping(input: { id: string; expectedRevision: number; actorId: string; key: string }) {
    return this.run(input, 'mapping.publish', { id: input.id, expectedRevision: input.expectedRevision }, async (session) => {
      const id = this.objectId(input.id);
      const candidate = await this.mappings.findOne({ _id: id, status: 'draft', revision: input.expectedRevision }).session(session).exec();
      if (!candidate) throw await this.notFoundOrConflict(this.mappings, id, session);
      await this.assertSpecialtiesActive(candidate.specialtyCodes, session);
      const previousCandidate = await this.mappings.findOne({ scope: candidate.scope, scopeKey: candidate.scopeKey, status: 'published' }).session(session).exec();
      const publishedAt = new Date();
      const transition = DiseaseSpecialtyMappingAggregate.publish({ candidate: this.toState(candidate), expectedRevision: input.expectedRevision, ...(previousCandidate ? { previous: this.toState(previousCandidate) } : {}), actorId: input.actorId, publishedAt });
      const previous = previousCandidate ? await this.mappings.findOneAndUpdate({ _id: previousCandidate._id, status: 'published', revision: previousCandidate.revision }, { $set: { ...transition.previous, retiredBy: new Types.ObjectId(transition.previous!.retiredBy) } }, { returnDocument: 'after', session }).exec() : null;
      if (previousCandidate && !previous) throw new ConflictException('MAPPING_REVISION_CONFLICT');
      const published = await this.mappings.findOneAndUpdate({ _id: id, status: 'draft', revision: input.expectedRevision }, { $set: { ...transition.candidate, publishedBy: new Types.ObjectId(transition.candidate.publishedBy) } }, { returnDocument: 'after', session }).exec();
      if (!published) throw new ConflictException('MAPPING_REVISION_CONFLICT');
      const audits = [{ entityType: 'DiseaseSpecialtyMapping', entityId: String(id), action: 'specialty_mapping_published', fromStatus: 'draft', toStatus: 'published', metadata: { scope: published.scope, scopeKey: published.scopeKey, version: published.version, revision: published.revision } }];
      if (previous) audits.unshift({ entityType: 'DiseaseSpecialtyMapping', entityId: String(previous._id), action: 'specialty_mapping_superseded', fromStatus: 'published', toStatus: 'retired', metadata: { scope: previous.scope, scopeKey: previous.scopeKey, version: previous.version, revision: previous.revision } });
      return { result: this.toRecord(published), audits };
    });
  }

  retireMapping(input: { id: string; reason: string; expectedRevision: number; actorId: string; key: string }): Promise<{ retired: true }> {
    return this.run(input, 'mapping.retire', { id: input.id, reason: input.reason, expectedRevision: input.expectedRevision }, async (session) => {
      const id = this.objectId(input.id);
      const existing = await this.mappings.findOne({ _id: id }).session(session).exec();
      if (!existing) throw new NotFoundException('MAPPING_NOT_FOUND');
      const transition = DiseaseSpecialtyMappingAggregate.retire({ current: this.toState(existing), expectedRevision: input.expectedRevision, actorId: input.actorId, retiredAt: new Date() });
      const row = await this.mappings.findOneAndUpdate({ _id: id, status: existing.status, revision: input.expectedRevision }, { $set: { ...transition, retiredBy: new Types.ObjectId(transition.retiredBy) } }, { returnDocument: 'after', session }).exec();
      if (!row) throw new ConflictException('MAPPING_REVISION_CONFLICT');
      return { result: { retired: true as const }, audits: [{ entityType: 'DiseaseSpecialtyMapping', entityId: String(id), action: 'specialty_mapping_retired', fromStatus: existing.status, toStatus: 'retired', reason: input.reason, metadata: { scope: row.scope, scopeKey: row.scopeKey, version: row.version, revision: row.revision } }] };
    });
  }

  private run<T extends object>(input: { actorId: string; key: string }, operation: string, request: unknown, work: (session: import('mongoose').ClientSession) => Promise<{ result: T; audits: import('./facility-command-transaction').FacilityAuditDraft[] }>): Promise<T> {
    return this.commands.run({ actorId: input.actorId, operation, key: input.key, request, work });
  }
  private objectId(id: string) { if (!Types.ObjectId.isValid(id)) throw new NotFoundException('MAPPING_NOT_FOUND'); return new Types.ObjectId(id); }
  private async assertSpecialtiesActive(codes: string[], session: import('mongoose').ClientSession) { const count = await this.specialties.countDocuments({ code: { $in: codes }, status: 'active' }).session(session).exec(); if (count !== new Set(codes).size) throw new ConflictException('MAPPING_SPECIALTY_NOT_ACTIVE'); }
  private async notFoundOrConflict(model: Model<DiseaseSpecialtyMappingDocument>, id: Types.ObjectId, session: import('mongoose').ClientSession) { return await model.exists({ _id: id }).session(session) ? new ConflictException('MAPPING_REVISION_CONFLICT') : new NotFoundException('MAPPING_NOT_FOUND'); }
  private toState(row: DiseaseSpecialtyMappingDocument): DiseaseSpecialtyMappingState { return { id: String(row._id), scope: row.scope, scopeKey: row.scopeKey, version: row.version, revision: row.revision, status: row.status, specialtyCodes: row.specialtyCodes, sourceReferences: row.sourceReferences }; }
  private toRecord(row: { _id: Types.ObjectId; scope: 'program' | 'disease'; scopeKey: string; version: number; revision: number; status: 'draft' | 'published' | 'retired'; specialtyCodes: string[]; sourceReferences: string[]; publishedAt?: Date }) { return { id: String(row._id), scope: row.scope, scopeKey: row.scopeKey, version: row.version, revision: row.revision, status: row.status, specialtyCodes: row.specialtyCodes, sourceReferences: row.sourceReferences, ...(row.publishedAt ? { publishedAt: row.publishedAt.toISOString() } : {}) }; }
}
