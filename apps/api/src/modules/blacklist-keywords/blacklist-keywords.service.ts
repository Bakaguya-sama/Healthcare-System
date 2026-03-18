import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BlacklistKeyword, BlacklistKeywordDocument } from './entities/blacklist-keyword.entity';
import { CreateBlacklistKeywordDto, UpdateBlacklistKeywordDto, QueryBlacklistKeywordDto } from './dto/create-blacklist-keyword.dto';

@Injectable()
export class BlacklistKeywordsService {
  constructor(
    @InjectModel(BlacklistKeyword.name) private keywordModel: Model<BlacklistKeywordDocument>,
  ) {}

  async create(userId: string, createDto: CreateBlacklistKeywordDto): Promise<BlacklistKeyword> {
    try {
      // Check if keyword already exists
      const existing = await this.keywordModel.findOne({ keyword: createDto.keyword.toLowerCase() });
      if (existing) {
        throw new ConflictException('This keyword is already blacklisted');
      }

      const keyword = new this.keywordModel({
        ...createDto,
        keyword: createDto.keyword.toLowerCase(),
        addedBy: new Types.ObjectId(userId),
        severity: createDto.severity || 'medium',
        exactMatch: createDto.exactMatch ?? true,
        caseInsensitive: createDto.caseInsensitive ?? true,
        isActive: true,
      });
      return await keyword.save();
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('This keyword is already blacklisted');
      }
      throw new BadRequestException(`Failed to create blacklist keyword: ${error.message}`);
    }
  }

  async findAll(query: QueryBlacklistKeywordDto): Promise<{ data: BlacklistKeyword[]; total: number }> {
    const { page = 1, limit = 10, category, severity, isActive, search, sortBy = 'createdAt', sortOrder = -1 } = query;

    const filter: any = {};

    if (category) filter.category = category;
    if (severity) filter.severity = severity;
    if (isActive !== undefined) filter.isActive = isActive;
    if (search) {
      filter.keyword = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    const data = await this.keywordModel
      .find(filter)
      .sort({ [sortBy]: sortOrder as any })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.keywordModel.countDocuments(filter);

    return { data, total };
  }

  async findById(keywordId: string): Promise<BlacklistKeyword> {
    const keyword = await this.keywordModel.findById(new Types.ObjectId(keywordId)).exec();
    if (!keyword) {
      throw new NotFoundException(`Blacklist keyword with ID ${keywordId} not found`);
    }
    return keyword;
  }

  async findByKeyword(keyword: string): Promise<BlacklistKeyword | null> {
    return await this.keywordModel.findOne({ keyword: keyword.toLowerCase(), isActive: true }).exec();
  }

  async update(keywordId: string, updateDto: UpdateBlacklistKeywordDto): Promise<BlacklistKeyword> {
    const keyword = await this.findById(keywordId);

    Object.assign(keyword, updateDto);
    return await keyword.save();
  }

  async checkContent(content: string): Promise<{ flagged: boolean; flaggedKeywords: BlacklistKeyword[] }> {
    const activeKeywords = await this.keywordModel.find({ isActive: true }).exec();

    const flaggedKeywords: BlacklistKeyword[] = [];

    for (const kw of activeKeywords) {
      const lowerContent = content.toLowerCase();
      const lowerKeyword = kw.keyword.toLowerCase();
      
      if (lowerContent.includes(lowerKeyword)) {
        flaggedKeywords.push(kw);
      }
    }

    return {
      flagged: flaggedKeywords.length > 0,
      flaggedKeywords,
    };
  }

  async delete(keywordId: string): Promise<BlacklistKeyword> {
    const keyword = await this.keywordModel.findByIdAndDelete(new Types.ObjectId(keywordId));

    if (!keyword) {
      throw new NotFoundException(`Blacklist keyword with ID ${keywordId} not found`);
    }
    return keyword;
  }

  async deactivate(keywordId: string): Promise<BlacklistKeyword> {
    const keyword = await this.keywordModel.findByIdAndUpdate(
      new Types.ObjectId(keywordId),
      { isActive: false },
      { new: true },
    );

    if (!keyword) {
      throw new NotFoundException(`Blacklist keyword with ID ${keywordId} not found`);
    }
    return keyword;
  }

  async activate(keywordId: string): Promise<BlacklistKeyword> {
    const keyword = await this.keywordModel.findByIdAndUpdate(
      new Types.ObjectId(keywordId),
      { isActive: true },
      { new: true },
    );

    if (!keyword) {
      throw new NotFoundException(`Blacklist keyword with ID ${keywordId} not found`);
    }
    return keyword;
  }
}
