import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BlacklistKeyword, BlacklistKeywordDocument } from './entities/blacklist-keyword.entity';
import { CreateBlacklistKeywordDto, UpdateBlacklistKeywordDto, QueryBlacklistKeywordDto } from './dto/create-blacklist-keyword.dto';

@Injectable()
export class BlacklistKeywordsService {
  constructor(
    @InjectModel(BlacklistKeyword.name) private keywordModel: Model<BlacklistKeywordDocument>,
  ) {}

  async create(createDto: CreateBlacklistKeywordDto): Promise<BlacklistKeyword> {
    try {
      const blacklist = new this.keywordModel({
        word_list: createDto.word_list.map(w => w.toLowerCase()),
      });
      return await blacklist.save();
    } catch (error) {
      throw new BadRequestException(`Failed to create blacklist: ${error.message}`);
    }
  }

  async findAll(query: QueryBlacklistKeywordDto): Promise<{ data: BlacklistKeyword[]; total: number }> {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = -1 } = query;

    const filter: any = {};

    if (search) {
      filter.word_list = { $regex: search, $options: 'i' };
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

  async findById(id: string): Promise<BlacklistKeyword> {
    const blacklist = await this.keywordModel.findById(new Types.ObjectId(id)).exec();
    if (!blacklist) {
      throw new NotFoundException(`Blacklist with ID ${id} not found`);
    }
    return blacklist;
  }

  async update(id: string, updateDto: UpdateBlacklistKeywordDto): Promise<BlacklistKeyword> {
    const blacklist = await this.findById(id);

    if (updateDto.word_list) {
      blacklist.word_list = updateDto.word_list.map(w => w.toLowerCase());
    }

    return await blacklist.save();
  }

  async checkContent(content: string): Promise<{ flagged: boolean; flaggedWords: string[] }> {
    const blacklists = await this.keywordModel.find().exec();

    const flaggedWords: Set<string> = new Set();
    const lowerContent = content.toLowerCase();

    for (const blacklist of blacklists) {
      for (const word of blacklist.word_list) {
        if (lowerContent.includes(word.toLowerCase())) {
          flaggedWords.add(word);
        }
      }
    }

    return {
      flagged: flaggedWords.size > 0,
      flaggedWords: Array.from(flaggedWords),
    };
  }

  async delete(id: string): Promise<BlacklistKeyword> {
    const blacklist = await this.keywordModel.findByIdAndDelete(new Types.ObjectId(id));

    if (!blacklist) {
      throw new NotFoundException(`Blacklist with ID ${id} not found`);
    }
    return blacklist;
  }
}
