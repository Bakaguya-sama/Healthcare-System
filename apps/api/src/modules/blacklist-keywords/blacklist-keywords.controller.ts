import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BlacklistKeywordsService } from './blacklist-keywords.service';
import { CreateBlacklistKeywordDto, UpdateBlacklistKeywordDto, QueryBlacklistKeywordDto } from './dto/create-blacklist-keyword.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { UserPayload } from '../auth/auth.payload';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('Blacklist Keywords')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('blacklist-keywords')
export class BlacklistKeywordsController {
  constructor(private readonly service: BlacklistKeywordsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@CurrentUser() user: UserPayload, @Body() createDto: CreateBlacklistKeywordDto) {
    return this.service.create(user.id, createDto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  async getAll(@Query() query: QueryBlacklistKeywordDto) {
    return this.service.findAll(query);
  }

  @Post('check')
  async checkContent(@Body() body: { content: string }) {
    return this.service.checkContent(body.content);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  async getKeyword(@Param('id') keywordId: string) {
    return this.service.findById(keywordId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async updateKeyword(@Param('id') keywordId: string, @Body() updateDto: UpdateBlacklistKeywordDto) {
    return this.service.update(keywordId, updateDto);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN)
  async deactivateKeyword(@Param('id') keywordId: string) {
    return this.service.deactivate(keywordId);
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN)
  async activateKeyword(@Param('id') keywordId: string) {
    return this.service.activate(keywordId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async deleteKeyword(@Param('id') keywordId: string) {
    return this.service.delete(keywordId);
  }
}
