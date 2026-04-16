import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AiDocument,
  AiDocumentDocument,
  DocumentStatus,
} from './entities/ai-document.entity';
import {
  AiDocumentChunk,
  AiDocumentChunkDocument,
} from '../ai-document-chunks/entities/ai-document-chunk.entity';
import {
  CreateAiDocumentDto,
  UpdateAiDocumentDto,
  QueryAiDocumentDto,
} from './dto/create-ai-document.dto';
import { CloudinaryService } from '../../core/services/cloudinary.service';

@Injectable()
export class AiDocumentsService {
  constructor(
    @InjectModel(AiDocument.name)
    private aiDocumentModel: Model<AiDocumentDocument>,
    @InjectModel(AiDocumentChunk.name)
    private aiDocumentChunkModel: Model<AiDocumentChunkDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(
    userId: string,
    file: Express.Multer.File,
    createDto: CreateAiDocumentDto,
  ): Promise<AiDocument> {
    try {
      if (!file) {
        throw new BadRequestException('No file provided');
      }

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
        status: DocumentStatus.PROCESSING,
      });

      // Create chunks

      return await document.save();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to create AI document: ${message}`);
    }
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
    const sort = { [sortBy]: normalizedSortOrder };

    const skip = (page - 1) * limit;
    const data = await this.aiDocumentModel
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.aiDocumentModel.countDocuments(filter);

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
    _userId: string,
    updateDto: UpdateAiDocumentDto,
  ): Promise<AiDocument> {
    void _userId;
    const document = await this.aiDocumentModel.findByIdAndUpdate(
      new Types.ObjectId(documentId),
      { $set: updateDto },
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
    _userId: string,
  ): Promise<AiDocument> {
    void _userId;
    const document = await this.findById(documentId);

    document.status = DocumentStatus.INACTIVE;
    return await document.save();
  }

  async delete(documentId: string, _userId: string): Promise<AiDocument> {
    void _userId;
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
      .limit(10)
      .exec();
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
}
