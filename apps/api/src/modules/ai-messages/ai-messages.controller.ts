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
import { AiMessagesService } from './ai-messages.service';
import { CreateAiMessageDto, UpdateAiMessageDto, QueryAiMessageDto } from './dto/create-ai-message.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { UserPayload } from '../auth/auth.payload';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('AI Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai-messages')
export class AiMessagesController {
  constructor(private readonly aiMessagesService: AiMessagesService) {}

  @Post()
  async create(@CurrentUser() user: UserPayload, @Body() createDto: CreateAiMessageDto) {
    return this.aiMessagesService.create(user.id, createDto);
  }

  @Get('session/:sessionId')
  async getSessionMessages(@CurrentUser() user: UserPayload, @Param('sessionId') sessionId: string, @Query() query: QueryAiMessageDto) {
    return this.aiMessagesService.findBySessionId(sessionId, query);
  }

  @Get('my-messages')
  async getMyMessages(@CurrentUser() user: UserPayload, @Query() query: QueryAiMessageDto) {
    return this.aiMessagesService.findByUserId(user.id, query);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  async getAllMessages(@Query() query: QueryAiMessageDto) {
    return this.aiMessagesService.findAll(query);
  }

  @Get(':id')
  async getMessage(@CurrentUser() user: UserPayload, @Param('id') messageId: string) {
    return this.aiMessagesService.findByIdAndUserId(messageId, user.id);
  }

  @Patch(':id')
  async updateMessage(
    @CurrentUser() user: UserPayload,
    @Param('id') messageId: string,
    @Body() updateDto: UpdateAiMessageDto,
  ) {
    return this.aiMessagesService.update(messageId, user.id, updateDto);
  }

  @Delete(':id')
  async deleteMessage(@CurrentUser() user: UserPayload, @Param('id') messageId: string) {
    return this.aiMessagesService.delete(messageId, user.id);
  }
}
