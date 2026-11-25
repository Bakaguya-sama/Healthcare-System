import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'crypto';
import {
  AiDocument,
  AiDocumentDocument,
  DocumentReviewStatus,
  DocumentStatus,
} from '../../../domain/knowledge-base/documents/ai-document.entity';
import {
  AiDocumentChunk,
  AiDocumentChunkDocument,
} from '../../../domain/knowledge-base/chunks/ai-document-chunk.entity';
import {
  CreateAiDocumentDto,
  UpdateAiDocumentDto,
  QueryAiDocumentDto,
} from '../../../presentation/knowledge-base/documents/create-ai-document.dto';
import { CloudinaryService } from '../../../../../infrastructure/files/cloudinary.service';

const AI_DOCUMENT_READ_PROJECTION =
  '_id title fileUrl fileType status reviewStatus validUntil uploadedBy approvedBy approvedAt createdAt updatedAt';
import type { UploadableFile } from '../../../../../infrastructure/files/cloudinary.service';
import { RagIngestionService } from '../../retrieval/rag-ingestion.service';
import { OutboxService } from '../../../../../infrastructure/outbox/outbox.service';
import { User, type UserDocument } from '../../../../users/public-api';
import { AdminRole, UserRole } from '../../../../../core/domain/user.enums';
import {
  AuditLog,
  type AuditLogDocument,
} from '../../../../platform-audit/public-api';

@Injectable()
export class AiDocumentsService {
  private readonly logger = new Logger(AiDocumentsService.name);

  constructor(
    @InjectModel(AiDocument.name)
    private aiDocumentModel: Model<AiDocumentDocument>,
    @InjectModel(AiDocumentChunk.name)
    private aiDocumentChunkModel: Model<AiDocumentChunkDocument>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly ragIngestionService: RagIngestionService,
    private readonly outbox: OutboxService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  async create(
    userId: string,
    file: UploadableFile,
    createDto: CreateAiDocumentDto,
  ): Promise<AiDocument> {
    try {
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      await this.assertKnowledgeManager(userId);

      const uploadResult = await this.cloudinaryService.uploadFile(
        file,
        'healthcare/ai/knowledge-base',
        'document',
      );

      const fileType = this.resolveFileType(file.originalname);
      const document = new this.aiDocumentModel({
        title: createDto.title?.trim() || file.originalname,
        fileUrl: uploadResult.secureUrl,
        fileType,
        publicId: uploadResult.publicId,
        uploadedBy: new Types.ObjectId(userId),
        contentHash: createHash('sha256').update(file.buffer).digest('hex'),
        status: DocumentStatus.PENDING_INGESTION,
        reviewStatus: DocumentReviewStatus.PENDING_REVIEW,
        validUntil: createDto.validUntil
          ? new Date(createDto.validUntil)
          : undefined,
      });

      await document.save();

      await this.recordTransition(
        document,
        userId,
        'submitted',
        undefined,
        DocumentReviewStatus.PENDING_REVIEW,
      );
      this.logger.log({
        event: 'knowledge.document.submitted',
        documentId: document._id.toString(),
      });

      return document;
    } catch (error: unknown) {
      if (
        error instanceof HttpException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        this.logger.error(
          `Create AI document failed: ${error.message}`,
          error.stack,
        );
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Create AI document failed: ${message}`);
      throw new BadRequestException(`Failed to create AI document: ${message}`);
    }
  }

  /**
   * Creates a metadata-only PubMed reference. It deliberately contains no
   * abstract and follows the ordinary document review/ingestion/activation path.
   */
  async createExternalReference(
    userId: string,
    file: UploadableFile,
    title: string,
  ): Promise<AiDocument> {
    const document = await this.create(userId, file, { title });
    document.source = 'pubmed';
    await document.save();
    return document;
  }

  async ragIngesting(documentId: string): Promise<never> {
    await this.findById(documentId);

    throw new BadRequestException(
      'Manual re-ingesting requires file payload and is not implemented yet. Ingestion is triggered automatically on create.',
    );
  }

  async approve(documentId: string, actorId: string): Promise<AiDocument> {
    await this.assertFullAdmin(actorId);
    const document = await this.findById(documentId);
    if (document.reviewStatus !== DocumentReviewStatus.PENDING_REVIEW)
      throw new BadRequestException(
        'Only a pending knowledge document can be approved',
      );
    document.reviewStatus = DocumentReviewStatus.APPROVED;
    document.status = DocumentStatus.PENDING_INGESTION;
    document.reviewedBy = new Types.ObjectId(actorId);
    document.reviewedAt = new Date();
    document.approvedBy = new Types.ObjectId(actorId);
    document.approvedAt = new Date();
    await document.save();
    await this.outbox.enqueue({
      eventType: 'knowledge.document.ingestion.requested.v1',
      aggregateType: 'AiDocument',
      aggregateId: document._id,
      payload: {
        documentId: document._id.toString(),
        ingestionVersion: document.ingestionVersion,
      },
      idempotencyKey: `knowledge.ingestion.${document._id.toString()}.${document.ingestionVersion}`,
    });
    await this.recordTransition(
      document,
      actorId,
      'approved',
      DocumentReviewStatus.PENDING_REVIEW,
      DocumentReviewStatus.APPROVED,
    );
    return document;
  }

  async replaceVersion(
    documentId: string,
    actorId: string,
    file: UploadableFile,
    dto: CreateAiDocumentDto,
  ): Promise<AiDocument> {
    await this.assertKnowledgeManager(actorId);
    const current = await this.findById(documentId);
    const replacement = await this.create(actorId, file, dto);
    replacement.parentDocumentId = current.parentDocumentId ?? current._id;
    replacement.documentVersion = current.documentVersion + 1;
    await replacement.save();
    await this.recordTransition(
      replacement,
      actorId,
      'replacement_submitted',
      undefined,
      DocumentReviewStatus.PENDING_REVIEW,
    );
    return replacement;
  }

  async reject(
    documentId: string,
    actorId: string,
    reason?: string,
  ): Promise<AiDocument> {
    await this.assertFullAdmin(actorId);
    const document = await this.findById(documentId);
    if (document.reviewStatus !== DocumentReviewStatus.PENDING_REVIEW)
      throw new BadRequestException(
        'Only a pending knowledge document can be rejected',
      );
    document.reviewStatus = DocumentReviewStatus.REJECTED;
    document.status = DocumentStatus.INACTIVE;
    document.reviewedBy = new Types.ObjectId(actorId);
    document.reviewedAt = new Date();
    document.reviewReason = reason?.trim() || null;
    await document.save();
    await this.recordTransition(
      document,
      actorId,
      'rejected',
      DocumentReviewStatus.PENDING_REVIEW,
      DocumentReviewStatus.REJECTED,
      reason,
    );
    return document;
  }

  async activate(documentId: string, actorId: string): Promise<AiDocument> {
    await this.assertFullAdmin(actorId);
    const document = await this.findById(documentId);
    if (
      document.reviewStatus !== DocumentReviewStatus.APPROVED ||
      document.status !== DocumentStatus.READY_FOR_ACTIVATION
    )
      throw new BadRequestException(
        'Only an approved and ingested knowledge document can be activated',
      );
    const parent = document.parentDocumentId ?? document._id;
    await this.aiDocumentModel.updateMany(
      {
        $or: [{ _id: parent }, { parentDocumentId: parent }],
        _id: { $ne: document._id },
      },
      { $set: { status: DocumentStatus.INACTIVE } },
    );
    document.status = DocumentStatus.ACTIVE;
    await document.save();
    await this.recordTransition(
      document,
      actorId,
      'activated',
      DocumentStatus.READY_FOR_ACTIVATION,
      DocumentStatus.ACTIVE,
    );
    return document;
  }

  async findAll(
    query: QueryAiDocumentDto,
  ): Promise<{ data: AiDocument[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = -1,
    } = query;

    const filter: Record<string, unknown> = {};

    if (status) filter.status = status;
    if (search) {
      filter.$or = [{ title: { $regex: search, $options: 'i' } }];
    }

    const normalizedSortOrder: 1 | -1 = sortOrder === 1 ? 1 : -1;
    const sort = { [sortBy]: normalizedSortOrder, _id: normalizedSortOrder };

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.aiDocumentModel
        .find(filter)
        .select(AI_DOCUMENT_READ_PROJECTION)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean<AiDocument[]>()
        .exec(),
      this.aiDocumentModel.countDocuments(filter),
    ]);

    return { data, total };
  }

  async findById(documentId: string): Promise<AiDocument> {
    const document = await this.aiDocumentModel
      .findById(new Types.ObjectId(documentId))
      .exec();
    if (!document) {
      throw new NotFoundException(
        `AI Document with ID ${documentId} not found`,
      );
    }
    return document;
  }

  async update(
    documentId: string,
    userId: string,
    updateDto: UpdateAiDocumentDto,
  ): Promise<AiDocument> {
    await this.assertKnowledgeManager(userId);
    const allowedMetadata = {
      ...(updateDto.title !== undefined ? { title: updateDto.title } : {}),
      ...(updateDto.validUntil !== undefined
        ? {
            validUntil: updateDto.validUntil
              ? new Date(updateDto.validUntil)
              : null,
          }
        : {}),
    };
    const document = await this.aiDocumentModel.findByIdAndUpdate(
      new Types.ObjectId(documentId),
      { $set: allowedMetadata },
      { new: true, runValidators: true },
    );

    if (!document) {
      throw new NotFoundException(
        `AI Document with ID ${documentId} not found`,
      );
    }

    return document;
  }

  async indexDocument(
    documentId: string,
    totalChunks: number,
  ): Promise<AiDocument> {
    void totalChunks;
    const document = await this.aiDocumentModel.findByIdAndUpdate(
      new Types.ObjectId(documentId),
      {
        status: DocumentStatus.ACTIVE,
      },
      { new: true },
    );

    if (!document) {
      throw new NotFoundException(
        `AI Document with ID ${documentId} not found`,
      );
    }
    return document;
  }

  async incrementUsageCount(documentId: string): Promise<AiDocument> {
    const document = await this.aiDocumentModel.findByIdAndUpdate(
      new Types.ObjectId(documentId),
      {},
      { new: true },
    );

    if (!document) {
      throw new NotFoundException(
        `AI Document with ID ${documentId} not found`,
      );
    }
    return document;
  }

  async archiveDocument(
    documentId: string,
    userId: string,
  ): Promise<AiDocument> {
    await this.assertFullAdmin(userId);
    const document = await this.findById(documentId);
    const previous = document.status;
    document.status = DocumentStatus.INACTIVE;
    document.reviewStatus = DocumentReviewStatus.ARCHIVED;
    await this.aiDocumentChunkModel.updateMany(
      { documentId: document._id },
      {
        $set: { isActive: false, reviewStatus: DocumentReviewStatus.ARCHIVED },
      },
    );
    const archived = await document.save();
    await this.recordTransition(
      archived,
      userId,
      'archived',
      previous,
      DocumentStatus.INACTIVE,
    );
    return archived;
  }

  async delete(documentId: string, userId: string): Promise<AiDocument> {
    await this.assertFullAdmin(userId);
    return this.deleteWithCascade(documentId);
  }

  async deleteById(documentId: string): Promise<AiDocument> {
    return this.deleteWithCascade(documentId);
  }

  async search(query: string): Promise<AiDocument[]> {
    return await this.aiDocumentModel
      .find({
        status: DocumentStatus.ACTIVE,
        $text: { $search: query },
      })
      .select(AI_DOCUMENT_READ_PROJECTION)
      .limit(10)
      .lean<AiDocument[]>()
      .exec();
  }

  /** Removes storage and integrity internals before a document crosses HTTP. */
  toPublicDocument(document: AiDocument): Record<string, unknown> {
    const value =
      typeof (document as { toObject?: unknown }).toObject === 'function'
        ? (document as unknown as { toObject: () => AiDocument }).toObject()
        : document;
    const { fileUrl, publicId, contentHash, ...safe } = value as AiDocument &
      Record<string, unknown>;
    void fileUrl;
    void publicId;
    void contentHash;
    return safe;
  }

  private resolveFileType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();

    if (!extension) {
      return 'txt';
    }

    if (['pdf', 'doc', 'docx', 'txt'].includes(extension)) {
      return extension;
    }

    return 'txt';
  }

  private async deleteWithCascade(documentId: string): Promise<AiDocument> {
    const existing = await this.findById(documentId);
    const documentObjectId = new Types.ObjectId(documentId);

    if (existing.publicId) {
      const cloudinaryDeleteResult = await this.cloudinaryService.deleteFile(
        existing.publicId,
        'document',
      );

      if (!cloudinaryDeleteResult.success) {
        throw new BadRequestException(
          `Failed to delete file on Cloudinary: ${cloudinaryDeleteResult.message}`,
        );
      }
    }

    await this.aiDocumentChunkModel.deleteMany({
      documentId: documentObjectId,
    });

    const deleted =
      await this.aiDocumentModel.findByIdAndDelete(documentObjectId);

    if (!deleted) {
      throw new NotFoundException(
        `AI Document with ID ${documentId} not found`,
      );
    }

    return deleted;
  }

  async completeIngestion(documentId: string): Promise<void> {
    const document = await this.findById(documentId);
    if (
      document.reviewStatus !== DocumentReviewStatus.APPROVED ||
      document.status === DocumentStatus.INACTIVE
    )
      return;
    document.status = DocumentStatus.READY_FOR_ACTIVATION;
    await document.save();
    await this.aiDocumentChunkModel.updateMany(
      { documentId: document._id },
      {
        $set: {
          reviewStatus: DocumentReviewStatus.APPROVED,
          validUntil: document.validUntil,
          isActive: true,
        },
      },
    );
  }

  async beginIngestion(documentId: string): Promise<AiDocument | null> {
    const document = await this.aiDocumentModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(documentId),
          reviewStatus: DocumentReviewStatus.APPROVED,
          status: DocumentStatus.PENDING_INGESTION,
        },
        { $set: { status: DocumentStatus.PROCESSING } },
        { new: true },
      )
      .exec();
    return document;
  }

  async markIngestionFailed(documentId: string): Promise<void> {
    await this.aiDocumentModel
      .updateOne(
        {
          _id: new Types.ObjectId(documentId),
          status: DocumentStatus.PROCESSING,
        },
        { $set: { status: DocumentStatus.ERROR } },
      )
      .exec();
  }

  private async assertKnowledgeManager(userId: string): Promise<void> {
    const user = await this.userModel
      .findById(userId)
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
        'Only an AI manager may submit or update knowledge documents',
      );
  }

  private async assertFullAdmin(userId: string): Promise<void> {
    const user = await this.userModel
      .findById(userId)
      .select('role adminProfile.adminRole')
      .lean()
      .exec();
    if (
      user?.role !== UserRole.ADMIN ||
      user.adminProfile?.adminRole !== AdminRole.SUPER_ADMIN
    )
      throw new ForbiddenException(
        'Only a full administrator may review or activate knowledge documents',
      );
  }

  private async recordTransition(
    document: AiDocument,
    actorId: string,
    action: string,
    fromStatus?: string,
    toStatus?: string,
    reason?: string,
  ): Promise<void> {
    await this.auditLogModel.create({
      domain: 'knowledge_base',
      entityType: 'AiDocument',
      entityId: document._id,
      action,
      actorId: new Types.ObjectId(actorId),
      fromStatus,
      toStatus,
      reason: reason?.slice(0, 500),
      metadata: {
        documentVersion: document.documentVersion,
        ingestionVersion: document.ingestionVersion,
      },
    });
  }
}
