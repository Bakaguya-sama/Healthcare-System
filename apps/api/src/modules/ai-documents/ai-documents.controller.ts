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
import { AiDocumentsService } from './ai-documents.service';
import { CreateAiDocumentDto, UpdateAiDocumentDto, QueryAiDocumentDto } from './dto/create-ai-document.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { UserPayload } from '../auth/auth.payload';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('AI Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai-documents')
export class AiDocumentsController {
  constructor(private readonly aiDocumentsService: AiDocumentsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@CurrentUser() user: UserPayload, @Body() createDto: CreateAiDocumentDto) {
    return this.aiDocumentsService.create(user.id, createDto);
  }

  @Get()
  async getAllDocuments(@Query() query: QueryAiDocumentDto) {
    return this.aiDocumentsService.findAll(query);
  }

  @Get('search/:query')
  async searchDocuments(@Param('query') searchQuery: string) {
    return this.aiDocumentsService.search(searchQuery);
  }

  @Get(':id')
  async getDocument(@Param('id') documentId: string) {
    return this.aiDocumentsService.findById(documentId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async updateDocument(
    @CurrentUser() user: UserPayload,
    @Param('id') documentId: string,
    @Body() updateDto: UpdateAiDocumentDto,
  ) {
    return this.aiDocumentsService.update(documentId, user.id, updateDto);
  }

  @Patch(':id/index')
  @Roles(UserRole.ADMIN)
  async indexDocument(@Param('id') documentId: string, @Body() body: { totalChunks: number }) {
    return this.aiDocumentsService.indexDocument(documentId, body.totalChunks);
  }

  @Patch(':id/usage')
  async incrementUsage(@Param('id') documentId: string) {
    return this.aiDocumentsService.incrementUsageCount(documentId);
  }

  @Patch(':id/archive')
  @Roles(UserRole.ADMIN)
  async archiveDocument(@CurrentUser() user: UserPayload, @Param('id') documentId: string) {
    return this.aiDocumentsService.archiveDocument(documentId, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async deleteDocument(@CurrentUser() user: UserPayload, @Param('id') documentId: string) {
    return this.aiDocumentsService.delete(documentId, user.id);
  }
}
