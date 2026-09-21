import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BlacklistKeyword,
  BlacklistKeywordDocument,
} from './entities/blacklist-keyword.entity';
import {
  CreateBlacklistKeywordDto,
  UpdateBlacklistKeywordDto,
  QueryBlacklistKeywordDto,
} from './dto/create-blacklist-keyword.dto';
import { CachePort } from '../../../common/cache/cache.port';
import { toLiteralCaseInsensitiveRegex } from '../../../common/query/search-pattern';

const BLACKLIST_KEYWORD_READ_PROJECTION = '_id keyword createdAt updatedAt';

@Injectable()
export class BlacklistKeywordsService {
  private static readonly ACTIVE_CACHE_KEY = 'ai:blacklist:active:v1';
  private static readonly ACTIVE_CACHE_TTL_MS = 60_000;

  constructor(
    @InjectModel(BlacklistKeyword.name)
    private keywordModel: Model<BlacklistKeywordDocument>,
    private readonly cache: CachePort,
  ) {}

  async create(
    createDto: CreateBlacklistKeywordDto,
  ): Promise<BlacklistKeyword> {
    try {
      const normalizedKeyword = createDto.keyword.trim().toLowerCase();

      if (!normalizedKeyword) {
        throw new BadRequestException('keyword must not be empty');
      }

      const blacklist = new this.keywordModel({
        keyword: normalizedKeyword,
      });
      const saved = await blacklist.save();
      await this.cache.delete(BlacklistKeywordsService.ACTIVE_CACHE_KEY);
      return saved;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to create blacklist: ${message}`);
    }
  }

  async findAll(
    query: QueryBlacklistKeywordDto,
  ): Promise<{ data: BlacklistKeyword[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = -1,
    } = query;

    const filter: Record<string, unknown> = {};

    if (search) {
      filter.keyword = toLiteralCaseInsensitiveRegex(search.trim());
    }

    const normalizedSortOrder: 1 | -1 = sortOrder === 1 ? 1 : -1;
    const sort = { [sortBy]: normalizedSortOrder, _id: normalizedSortOrder };

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.keywordModel
        .find(filter)
        .select(BLACKLIST_KEYWORD_READ_PROJECTION)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean<BlacklistKeyword[]>()
        .exec(),
      this.keywordModel.countDocuments(filter),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<BlacklistKeyword> {
    const blacklist = await this.keywordModel
      .findById(new Types.ObjectId(id))
      .exec();
    if (!blacklist) {
      throw new NotFoundException(`Blacklist with ID ${id} not found`);
    }
    return blacklist;
  }

  async update(
    id: string,
    updateDto: UpdateBlacklistKeywordDto,
  ): Promise<BlacklistKeyword> {
    const blacklist = await this.findById(id);

    if (updateDto.keyword) {
      const normalizedKeyword = updateDto.keyword.trim().toLowerCase();

      if (!normalizedKeyword) {
        throw new BadRequestException('keyword must not be empty');
      }

      blacklist.keyword = normalizedKeyword;
    }

    const saved = await blacklist.save();
    await this.cache.delete(BlacklistKeywordsService.ACTIVE_CACHE_KEY);
    return saved;
  }

  async getActiveKeywords(): Promise<string[]> {
    const blacklists = await this.cache.getOrSet(
      BlacklistKeywordsService.ACTIVE_CACHE_KEY,
      BlacklistKeywordsService.ACTIVE_CACHE_TTL_MS,
      () =>
        this.keywordModel
          .find()
          .select('keyword')
          .limit(1000)
          .lean<Array<{ keyword: string }>>()
          .exec(),
    );
    return blacklists
      .map((blacklist) => blacklist.keyword?.trim().toLowerCase())
      .filter((keyword): keyword is string => Boolean(keyword));
  }

  async checkContent(
    content: string,
  ): Promise<{ flagged: boolean; flaggedWords: string[] }> {
    const blacklists = await this.getActiveKeywords();

    const flaggedWords: Set<string> = new Set();
    const lowerContent = content.toLowerCase();

    for (const keyword of blacklists) {
      if (lowerContent.includes(keyword)) {
        flaggedWords.add(keyword);
      }
    }

    return {
      flagged: flaggedWords.size > 0,
      flaggedWords: Array.from(flaggedWords),
    };
  }

  async delete(id: string): Promise<BlacklistKeyword> {
    const blacklist = await this.keywordModel.findByIdAndDelete(
      new Types.ObjectId(id),
    );

    if (!blacklist) {
      throw new NotFoundException(`Blacklist with ID ${id} not found`);
    }
    await this.cache.delete(BlacklistKeywordsService.ACTIVE_CACHE_KEY);
    return blacklist;
  }
}
