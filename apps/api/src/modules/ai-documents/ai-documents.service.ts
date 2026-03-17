import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiDocument, AiDocumentDocument, DocumentStatus } from './entities/ai-document.entity';
import { CreateAiDocumentDto, UpdateAiDocumentDto, QueryAiDocumentDto } from './dto/create-ai-document.dto';

@Injectable()
export class AiDocumentsService {
  constructor(
    @InjectModel(AiDocument.name) private aiDocumentModel: Model<AiDocumentDocument>,
  ) {}

  async create(userId: string, createDto: CreateAiDocumentDto): Promise<AiDocument> {
    try {
      const document = new this.aiDocumentModel({
        ...createDto,
        uploadedBy: new Types.ObjectId(userId),
        relatedDocuments: createDto.relatedDocuments?.map(id => new Types.ObjectId(id)) || [],
        status: DocumentStatus.DRAFT,
        totalChunks: 0,
        usageCount: 0,
      });
      return await document.save();
    } catch (error) {
      throw new BadRequestException(`Failed to create AI document: ${error.message}`);
    }
  }

  async findAll(query: QueryAiDocumentDto): Promise<{ data: AiDocument[]; total: number }> {
    const { page = 1, limit = 10, documentType, status, search, tag, sortBy = 'createdAt', sortOrder = -1 } = query;

    const filter: any = {};

    if (documentType) filter.documentType = documentType;
    if (status) filter.status = status;
    if (tag) filter.tags = { $in: [tag] };
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const data = await this.aiDocumentModel
      .find(filter)
      .sort({ [sortBy]: sortOrder as any })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.aiDocumentModel.countDocuments(filter);

    return { data, total };
  }

  async findById(documentId: string): Promise<AiDocument> {
    const document = await this.aiDocumentModel.findById(new Types.ObjectId(documentId)).exec();
    if (!document) {
      throw new NotFoundException(`AI Document with ID ${documentId} not found`);
    }
    return document;
  }

  async update(documentId: string, userId: string, updateDto: UpdateAiDocumentDto): Promise<AiDocument> {
    const document = await this.findById(documentId);

    // Only uploader or admin can update
    if (document.uploadedBy.toString() !== userId) {
      throw new ForbiddenException('Only document uploader can update this document');
    }

    if (updateDto.relatedDocuments) {
      updateDto.relatedDocuments = updateDto.relatedDocuments.map(id => new Types.ObjectId(id) as any);
    }

    Object.assign(document, updateDto);
    return await document.save();
  }

  async indexDocument(documentId: string, totalChunks: number): Promise<AiDocument> {
    const document = await this.aiDocumentModel.findByIdAndUpdate(
      new Types.ObjectId(documentId),
      {
        status: DocumentStatus.INDEXED,
        totalChunks,
        indexedAt: new Date(),
      },
      { new: true },
    );

    if (!document) {
      throw new NotFoundException(`AI Document with ID ${documentId} not found`);
    }
    return document;
  }

  async incrementUsageCount(documentId: string): Promise<AiDocument> {
    const document = await this.aiDocumentModel.findByIdAndUpdate(
      new Types.ObjectId(documentId),
      { $inc: { usageCount: 1 } },
      { new: true },
    );

    if (!document) {
      throw new NotFoundException(`AI Document with ID ${documentId} not found`);
    }
    return document;
  }

  async archiveDocument(documentId: string, userId: string): Promise<AiDocument> {
    const document = await this.findById(documentId);

    if (document.uploadedBy.toString() !== userId) {
      throw new ForbiddenException('Only document uploader can archive this document');
    }

    document.status = DocumentStatus.ARCHIVED;
    return await document.save();
  }

  async delete(documentId: string, userId: string): Promise<AiDocument> {
    const document = await this.findById(documentId);

    if (document.uploadedBy.toString() !== userId) {
      throw new ForbiddenException('Only document uploader can delete this document');
    }

    const deleted = await this.aiDocumentModel.findByIdAndDelete(new Types.ObjectId(documentId));
    if (!deleted) {
      throw new NotFoundException(`AI Document with ID ${documentId} not found`);
    }
    return deleted;
  }

  async deleteById(documentId: string): Promise<AiDocument> {
    const document = await this.aiDocumentModel.findByIdAndDelete(new Types.ObjectId(documentId));

    if (!document) {
      throw new NotFoundException(`AI Document with ID ${documentId} not found`);
    }
    return document;
  }

  async search(query: string): Promise<AiDocument[]> {
    return await this.aiDocumentModel
      .find({
        status: DocumentStatus.INDEXED,
        $text: { $search: query },
      })
      .limit(10)
      .exec();
  }
}
