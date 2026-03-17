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
import { AiSessionsService } from './ai-sessions.service';
import { CreateAiSessionDto, UpdateAiSessionDto, QueryAiSessionDto } from './dto/create-ai-session.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { UserPayload } from '../auth/auth.payload';

@ApiTags('AI Sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-sessions')
export class AiSessionsController {
  constructor(private readonly aiSessionsService: AiSessionsService) {}

  @Post()
  async create(@CurrentUser() user: UserPayload, @Body() createDto: CreateAiSessionDto) {
    return this.aiSessionsService.create(user.id, createDto);
  }

  @Get('my-sessions')
  async getMySessionsHistory(@CurrentUser() user: UserPayload, @Query() query: QueryAiSessionDto) {
    return this.aiSessionsService.findByUserId(user.id, query);
  }

  @Get()
  async getAllSessions(@Query() query: QueryAiSessionDto) {
    return this.aiSessionsService.findAll(query);
  }

  @Get(':id')
  async getSession(@CurrentUser() user: UserPayload, @Param('id') sessionId: string) {
    return this.aiSessionsService.findByIdAndUserId(sessionId, user.id);
  }

  @Patch(':id')
  async updateSession(
    @CurrentUser() user: UserPayload,
    @Param('id') sessionId: string,
    @Body() updateDto: UpdateAiSessionDto,
  ) {
    return this.aiSessionsService.update(sessionId, user.id, updateDto);
  }

  @Patch(':id/complete')
  async completeSession(
    @CurrentUser() user: UserPayload,
    @Param('id') sessionId: string,
    @Body() body: { summary?: string },
  ) {
    return this.aiSessionsService.completeSession(sessionId, user.id, body.summary);
  }

  @Patch(':id/archive')
  async archiveSession(@CurrentUser() user: UserPayload, @Param('id') sessionId: string) {
    return this.aiSessionsService.archiveSession(sessionId, user.id);
  }

  @Delete(':id')
  async deleteSession(@CurrentUser() user: UserPayload, @Param('id') sessionId: string) {
    return this.aiSessionsService.delete(sessionId, user.id);
  }
}
