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
import { AiDocumentChunksService } from './ai-document-chunks.service';
import { CreateAiDocumentChunkDto, UpdateAiDocumentChunkDto, QueryAiDocumentChunkDto } from './dto/create-ai-document-chunk.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('AI Document Chunks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai-document-chunks')
export class AiDocumentChunksController {
  constructor(private readonly chunksService: AiDocumentChunksService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() createDto: CreateAiDocumentChunkDto) {
    return this.chunksService.create(createDto);
  }

  @Post('batch')
  @Roles(UserRole.ADMIN)
  async createMany(@Body() chunks: CreateAiDocumentChunkDto[]) {
    return this.chunksService.createMany(chunks);
  }

  @Get('document/:documentId')
  async getDocumentChunks(@Param('documentId') documentId: string, @Query() query: QueryAiDocumentChunkDto) {
    return this.chunksService.findByDocumentId(documentId, query);
  }

  @Get('search/:query')
  async searchChunks(@Param('query') searchQuery: string) {
    return this.chunksService.search(searchQuery);
  }

  @Get()
  async getAllChunks(@Query() query: QueryAiDocumentChunkDto) {
    return this.chunksService.findAll(query);
  }

  @Get(':id')
  async getChunk(@Param('id') chunkId: string) {
    return this.chunksService.findById(chunkId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async updateChunk(@Param('id') chunkId: string, @Body() updateDto: UpdateAiDocumentChunkDto) {
    return this.chunksService.update(chunkId, updateDto);
  }

  @Patch(':id/usage')
  async incrementUsage(@Param('id') chunkId: string) {
    return this.chunksService.incrementUsage(chunkId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async deleteChunk(@Param('id') chunkId: string) {
    return this.chunksService.delete(chunkId);
  }

  @Delete('document/:documentId')
  @Roles(UserRole.ADMIN)
  async deleteDocumentChunks(@Param('documentId') documentId: string) {
    return this.chunksService.deleteByDocumentId(documentId);
  }
}
