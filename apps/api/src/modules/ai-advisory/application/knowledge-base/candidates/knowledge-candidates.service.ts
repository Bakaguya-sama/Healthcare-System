import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Model, Types } from 'mongoose';
import { AdminRole, UserRole } from '../../../../../core/domain/user.enums';
import { OutboxService } from '../../../../../infrastructure/outbox/outbox.service';
import {
  AuditLog,
  type AuditLogDocument,
} from '../../../../platform-audit/public-api';
import { User, type UserDocument } from '../../../../users/public-api';
import {
  KnowledgeCandidate,
  KnowledgeCandidateDocument,
  KnowledgeCandidateStatus,
} from '../../../domain/knowledge-base/knowledge-candidate.entity';
import { AiDocumentsService } from '../documents/ai-documents.service';
import type { ProposeKnowledgeCandidateDto } from '../../../presentation/knowledge-base/candidates/knowledge-candidate.dto';

@Injectable()
export class KnowledgeCandidatesService {
  constructor(
    @InjectModel(KnowledgeCandidate.name)
    private readonly candidates: Model<KnowledgeCandidateDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(AuditLog.name)
    private readonly audits: Model<AuditLogDocument>,
    private readonly outbox: OutboxService,
    private readonly documents: AiDocumentsService,
  ) {}

  async propose(actorId: string, dto: ProposeKnowledgeCandidateDto) {
    await this.assertAiManager(actorId);
    const pmid = dto.pmid.trim();
    try {
      const candidate = await this.createPendingCandidate({
        pmid,
        title: dto.title,
        sourceUrl: dto.sourceUrl,
      });
      await this.record(
        candidate,
        actorId,
        'proposed',
        undefined,
        KnowledgeCandidateStatus.PENDING_REVIEW,
      );
      await this.outbox.enqueue({
        eventType: 'knowledge.candidate.proposed.v1',
        aggregateType: 'KnowledgeCandidate',
        aggregateId: candidate._id,
        payload: { candidateId: candidate._id.toString() },
        idempotencyKey: `knowledge.candidate.proposed.${candidate._id.toString()}`,
      });
      return candidate;
    } catch (error: unknown) {
      if ((error as { code?: number }).code === 11000)
        throw new ConflictException(
          'This PubMed article is already a knowledge candidate',
        );
      throw error;
    }
  }

  /**
   * Quarantines PubMed metadata discovered while answering a patient.  It never
   * makes the record a retrieval source and deliberately has no patient actor:
   * the audit marks it as an automated system discovery without persisting the
   * patient query or any patient data.
   */
  async captureExternalDiscoveries(
    records: ReadonlyArray<{ pmid: string; title: string; sourceUrl: string }>,
  ): Promise<number> {
    let created = 0;
    for (const record of records) {
      try {
        const candidate = await this.createPendingCandidate(record);
        await this.record(
          candidate,
          undefined,
          'externally_discovered',
          undefined,
          KnowledgeCandidateStatus.PENDING_REVIEW,
          undefined,
          { source: 'pubmed', automated: true },
        );
        await this.outbox.enqueue({
          eventType: 'knowledge.candidate.discovered.v1',
          aggregateType: 'KnowledgeCandidate',
          aggregateId: candidate._id,
          payload: { candidateId: candidate._id.toString(), source: 'pubmed' },
          idempotencyKey: `knowledge.candidate.discovered.${candidate._id.toString()}`,
        });
        created += 1;
      } catch (error: unknown) {
        // A concurrent or previous discovery is an idempotent no-op.
        if ((error as { code?: number }).code !== 11000) throw error;
      }
    }
    return created;
  }

  async list(actorId: string) {
    await this.assertAiManager(actorId);
    return this.candidates
      .find()
      .sort({ createdAt: -1, _id: -1 })
      .lean()
      .exec();
  }

  async promote(candidateId: string, actorId: string) {
    await this.assertSuperAdmin(actorId);
    const candidate = await this.find(candidateId);
    if (candidate.status !== KnowledgeCandidateStatus.PENDING_REVIEW)
      throw new ConflictException(
        'Only a pending knowledge candidate can be promoted',
      );
    const text = `PubMed reference\nTitle: ${candidate.title}\nPMID: ${candidate.pmid}\nSource: ${candidate.sourceUrl}\n`;
    const document = await this.documents.createExternalReference(
      actorId,
      {
        buffer: Buffer.from(text, 'utf8'),
        originalname: `pubmed-${candidate.pmid}.txt`,
        mimetype: 'text/plain',
        size: Buffer.byteLength(text),
      },
      candidate.title,
    );
    candidate.status = KnowledgeCandidateStatus.PROMOTED;
    candidate.reviewedBy = new Types.ObjectId(actorId);
    candidate.reviewedAt = new Date();
    await candidate.save();
    await this.record(
      candidate,
      actorId,
      'promoted',
      KnowledgeCandidateStatus.PENDING_REVIEW,
      KnowledgeCandidateStatus.PROMOTED,
      undefined,
      { documentId: document._id.toString(), source: 'pubmed' },
    );
    await this.outbox.enqueue({
      eventType: 'knowledge.candidate.promoted.v1',
      aggregateType: 'KnowledgeCandidate',
      aggregateId: candidate._id,
      payload: {
        candidateId: candidate._id.toString(),
        documentId: document._id.toString(),
      },
      idempotencyKey: `knowledge.candidate.promoted.${candidate._id.toString()}`,
    });
    return { candidate, document: this.documents.toPublicDocument(document) };
  }

  async reject(candidateId: string, actorId: string, reason?: string) {
    await this.assertSuperAdmin(actorId);
    const candidate = await this.find(candidateId);
    if (candidate.status !== KnowledgeCandidateStatus.PENDING_REVIEW)
      throw new ConflictException(
        'Only a pending knowledge candidate can be rejected',
      );
    candidate.status = KnowledgeCandidateStatus.REJECTED;
    candidate.reviewedBy = new Types.ObjectId(actorId);
    candidate.reviewedAt = new Date();
    candidate.reviewReason = reason?.trim() || null;
    await candidate.save();
    await this.record(
      candidate,
      actorId,
      'rejected',
      KnowledgeCandidateStatus.PENDING_REVIEW,
      KnowledgeCandidateStatus.REJECTED,
      reason,
    );
    await this.outbox.enqueue({
      eventType: 'knowledge.candidate.rejected.v1',
      aggregateType: 'KnowledgeCandidate',
      aggregateId: candidate._id,
      payload: { candidateId: candidate._id.toString() },
      idempotencyKey: `knowledge.candidate.rejected.${candidate._id.toString()}`,
    });
    return candidate;
  }

  private async find(id: string) {
    const candidate = await this.candidates.findById(id).exec();
    if (!candidate)
      throw new NotFoundException('Knowledge candidate not found');
    return candidate;
  }
  private async createPendingCandidate(input: {
    pmid: string;
    title: string;
    sourceUrl: string;
  }) {
    const pmid = input.pmid.trim();
    return this.candidates.create({
      pmid,
      contentHash: createHash('sha256').update(`pubmed:${pmid}`).digest('hex'),
      title: input.title.trim().slice(0, 500),
      sourceUrl: input.sourceUrl,
      status: KnowledgeCandidateStatus.PENDING_REVIEW,
    });
  }
  private async assertAiManager(actorId: string) {
    const user = await this.users
      .findById(actorId)
      .select('role adminProfile.adminRole')
      .lean()
      .exec();
    if (
      user?.role !== UserRole.ADMIN ||
      ![AdminRole.AI_MANAGER, AdminRole.SUPER_ADMIN].includes(
        user.adminProfile?.adminRole as AdminRole,
      )
    )
      throw new ForbiddenException(
        'Only an AI manager may view or propose knowledge candidates',
      );
  }
  private async assertSuperAdmin(actorId: string) {
    const user = await this.users
      .findById(actorId)
      .select('role adminProfile.adminRole')
      .lean()
      .exec();
    if (
      user?.role !== UserRole.ADMIN ||
      user.adminProfile?.adminRole !== AdminRole.SUPER_ADMIN
    )
      throw new ForbiddenException(
        'Only a super administrator may review a knowledge candidate',
      );
  }
  private async record(
    candidate: KnowledgeCandidate,
    actorId: string | undefined,
    action: string,
    fromStatus?: string,
    toStatus?: string,
    reason?: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.audits.create({
      domain: 'knowledge_base',
      entityType: 'KnowledgeCandidate',
      entityId: candidate._id,
      action,
      actorId: actorId ? new Types.ObjectId(actorId) : undefined,
      fromStatus,
      toStatus,
      reason: reason?.slice(0, 500),
      metadata: { pmid: candidate.pmid, ...metadata },
    });
  }
}
