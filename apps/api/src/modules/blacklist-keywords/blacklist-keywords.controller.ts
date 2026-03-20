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
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('Blacklist Keywords')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('blacklist-keywords')
export class BlacklistKeywordsController {
  constructor(private readonly service: BlacklistKeywordsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() createDto: CreateBlacklistKeywordDto) {
    return this.service.create(createDto);
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
  async getKeyword(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async updateKeyword(@Param('id') id: string, @Body() updateDto: UpdateBlacklistKeywordDto) {
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async deleteKeyword(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
