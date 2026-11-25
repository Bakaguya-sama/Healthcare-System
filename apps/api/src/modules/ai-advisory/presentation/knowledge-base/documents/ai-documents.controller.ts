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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiOperation,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiDocumentsService } from '../../../application/knowledge-base/documents/ai-documents.service';
import {
  CreateAiDocumentDto,
  UpdateAiDocumentDto,
  QueryAiDocumentDto,
} from './create-ai-document.dto';
import { JwtAuthGuard } from '../../../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../../core/decorators/roles.decorator';
import { RolesGuard } from '../../../../../core/guards/roles.guard';
import type { UserPayload } from '../../../../authentication/public-api';
import { UserRole } from '../../../../../core/domain/user.enums';
import type { UploadableFile } from '../../../../../infrastructure/files/cloudinary.service';

@ApiTags('AI Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai-documents')
export class AiDocumentsController {
  constructor(private readonly aiDocumentsService: AiDocumentsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Create AI document (upload file and persist metadata in one request)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document file (pdf/doc/docx/txt)',
        },
        title: {
          type: 'string',
          description: 'Optional title. Defaults to filename when omitted',
        },
      },
      required: ['file'],
    },
  })
  async create(
    @CurrentUser() user: UserPayload,
    @UploadedFile() file: UploadableFile,
    @Body() createDto: CreateAiDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.aiDocumentsService.toPublicDocument(
      await this.aiDocumentsService.create(user.id, file, createDto),
    );
  }

  @Get()
  async getAllDocuments(@Query() query: QueryAiDocumentDto) {
    const result = await this.aiDocumentsService.findAll(query);
    return {
      ...result,
      data: result.data.map((document) =>
        this.aiDocumentsService.toPublicDocument(document),
      ),
    };
  }

  @Get('search/:query')
  async searchDocuments(@Param('query') searchQuery: string) {
    return (await this.aiDocumentsService.search(searchQuery)).map((document) =>
      this.aiDocumentsService.toPublicDocument(document),
    );
  }

  @Get(':id')
  async getDocument(@Param('id') documentId: string) {
    return this.aiDocumentsService.toPublicDocument(
      await this.aiDocumentsService.findById(documentId),
    );
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async updateDocument(
    @CurrentUser() user: UserPayload,
    @Param('id') documentId: string,
    @Body() updateDto: UpdateAiDocumentDto,
  ) {
    return this.aiDocumentsService.toPublicDocument(
      await this.aiDocumentsService.update(documentId, user.id, updateDto),
    );
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  async approveDocument(
    @CurrentUser() user: UserPayload,
    @Param('id') documentId: string,
  ) {
    return this.aiDocumentsService.toPublicDocument(
      await this.aiDocumentsService.approve(documentId, user.id),
    );
  }

  @Post(':id/replacements')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  async replaceDocumentVersion(
    @CurrentUser() user: UserPayload,
    @Param('id') documentId: string,
    @UploadedFile() file: UploadableFile,
    @Body() dto: CreateAiDocumentDto,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.aiDocumentsService.toPublicDocument(
      await this.aiDocumentsService.replaceVersion(
        documentId,
        user.id,
        file,
        dto,
      ),
    );
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  async rejectDocument(
    @CurrentUser() user: UserPayload,
    @Param('id') documentId: string,
    @Body() body: { reason?: string },
  ) {
    return this.aiDocumentsService.toPublicDocument(
      await this.aiDocumentsService.reject(documentId, user.id, body.reason),
    );
  }

  @Post(':id/activate')
  @Roles(UserRole.ADMIN)
  async activateDocument(
    @CurrentUser() user: UserPayload,
    @Param('id') documentId: string,
  ) {
    return this.aiDocumentsService.toPublicDocument(
      await this.aiDocumentsService.activate(documentId, user.id),
    );
  }

  @Patch(':id/index')
  @Roles(UserRole.ADMIN)
  async indexDocument(
    @Param('id') documentId: string,
    @Body() body: { totalChunks: number },
  ) {
    return this.aiDocumentsService.indexDocument(documentId, body.totalChunks);
  }

  @Patch(':id/usage')
  async incrementUsage(@Param('id') documentId: string) {
    return this.aiDocumentsService.incrementUsageCount(documentId);
  }

  @Patch(':id/archive')
  @Roles(UserRole.ADMIN)
  async archiveDocument(
    @CurrentUser() user: UserPayload,
    @Param('id') documentId: string,
  ) {
    return this.aiDocumentsService.toPublicDocument(
      await this.aiDocumentsService.archiveDocument(documentId, user.id),
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async deleteDocument(
    @CurrentUser() user: UserPayload,
    @Param('id') documentId: string,
  ) {
    return this.aiDocumentsService.toPublicDocument(
      await this.aiDocumentsService.delete(documentId, user.id),
    );
  }

  @Post(':id/rag-ingesting')
  @Roles(UserRole.ADMIN)
  async ragIngesting(@Param('id') documentId: string): Promise<never> {
    return await this.aiDocumentsService.ragIngesting(documentId);
  }
}
