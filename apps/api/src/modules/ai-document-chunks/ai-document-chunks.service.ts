import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiDocumentChunk, AiDocumentChunkDocument } from './entities/ai-document-chunk.entity';
import { CreateAiDocumentChunkDto, UpdateAiDocumentChunkDto, QueryAiDocumentChunkDto } from './dto/create-ai-document-chunk.dto';

@Injectable()
export class AiDocumentChunksService {
  constructor(
    @InjectModel(AiDocumentChunk.name) private chunkModel: Model<AiDocumentChunkDocument>,
  ) {}

  async create(createDto: CreateAiDocumentChunkDto): Promise<AiDocumentChunk> {
    try {
      const chunk = new this.chunkModel({
        ...createDto,
        documentId: new Types.ObjectId(createDto.documentId),
        relatedChunks: createDto.relatedChunks?.map(id => new Types.ObjectId(id)) || [],
        charCount: createDto.content.length,
        usageCount: 0,
      });
      return await chunk.save();
    } catch (error) {
      throw new BadRequestException(`Failed to create chunk: ${error.message}`);
    }
  }

  async createMany(chunks: CreateAiDocumentChunkDto[]): Promise<AiDocumentChunk[]> {
    try {
      const chunksWithData = chunks.map(chunk => ({
        ...chunk,
        documentId: new Types.ObjectId(chunk.documentId),
        relatedChunks: chunk.relatedChunks?.map(id => new Types.ObjectId(id)) || [],
        charCount: chunk.content.length,
        tokenCount: chunk.tokenCount || 0,
        usageCount: 0,
      }));
      return (await this.chunkModel.insertMany(chunksWithData)) as AiDocumentChunk[];
    } catch (error) {
      throw new BadRequestException(`Failed to create chunks: ${error.message}`);
    }
  }

  async findByDocumentId(documentId: string, query: QueryAiDocumentChunkDto): Promise<{ data: AiDocumentChunk[]; total: number }> {
    const { page = 1, limit = 10, search, sortBy = 'chunkIndex', sortOrder = 1 } = query;

    const filter: any = { documentId: new Types.ObjectId(documentId) };

    if (search) {
      filter.content = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    const data = await this.chunkModel
      .find(filter)
      .sort({ [sortBy]: sortOrder as any })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.chunkModel.countDocuments(filter);

    return { data, total };
  }

  async findAll(query: QueryAiDocumentChunkDto): Promise<{ data: AiDocumentChunk[]; total: number }> {
    const { page = 1, limit = 10, search, sortBy = 'chunkIndex', sortOrder = 1 } = query;

    const filter: any = {};

    if (search) {
      filter.content = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    const data = await this.chunkModel
      .find(filter)
      .sort({ [sortBy]: sortOrder as any })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.chunkModel.countDocuments(filter);

    return { data, total };
  }

  async findById(chunkId: string): Promise<AiDocumentChunk> {
    const chunk = await this.chunkModel.findById(new Types.ObjectId(chunkId)).exec();
    if (!chunk) {
      throw new NotFoundException(`Chunk with ID ${chunkId} not found`);
    }
    return chunk;
  }

  async update(chunkId: string, updateDto: UpdateAiDocumentChunkDto): Promise<AiDocumentChunk> {
    const chunk = await this.findById(chunkId);

    if (updateDto.relatedChunks) {
      updateDto.relatedChunks = updateDto.relatedChunks.map(id => new Types.ObjectId(id) as any);
    }

    Object.assign(chunk, updateDto);
    return await chunk.save();
  }

  async incrementUsage(chunkId: string): Promise<AiDocumentChunk> {
    const chunk = await this.chunkModel.findByIdAndUpdate(
      new Types.ObjectId(chunkId),
      { $inc: { usageCount: 1 } },
      { new: true },
    );

    if (!chunk) {
      throw new NotFoundException(`Chunk with ID ${chunkId} not found`);
    }
    return chunk;
  }

  async search(query: string, limit: number = 10): Promise<AiDocumentChunk[]> {
    return await this.chunkModel
      .find({ $text: { $search: query } })
      .limit(limit)
      .exec();
  }

  async delete(chunkId: string): Promise<AiDocumentChunk> {
    const chunk = await this.chunkModel.findByIdAndDelete(new Types.ObjectId(chunkId));

    if (!chunk) {
      throw new NotFoundException(`Chunk with ID ${chunkId} not found`);
    }
    return chunk;
  }

  async deleteByDocumentId(documentId: string): Promise<{ deletedCount: number }> {
    const result = await this.chunkModel.deleteMany({
      documentId: new Types.ObjectId(documentId),
    });

    return { deletedCount: result.deletedCount };
  }
}
