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
import { AiFeedbacksService } from './ai-feedbacks.service';
import { CreateAiFeedbackDto, UpdateAiFeedbackDto, QueryAiFeedbackDto } from './dto/create-ai-feedback.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { UserPayload } from '../auth/auth.payload';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('AI Feedbacks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai-feedbacks')
export class AiFeedbacksController {
  constructor(private readonly aiFeedbacksService: AiFeedbacksService) {}

  @Post()
  async create(@CurrentUser() user: UserPayload, @Body() createDto: CreateAiFeedbackDto) {
    return this.aiFeedbacksService.create(user.id, createDto);
  }

  @Get('my-feedbacks')
  async getMyFeedbacks(@CurrentUser() user: UserPayload, @Query() query: QueryAiFeedbackDto) {
    return this.aiFeedbacksService.findByUserId(user.id, query);
  }

  @Get('session/:sessionId')
  async getSessionFeedbacks(@Param('sessionId') sessionId: string, @Query() query: QueryAiFeedbackDto) {
    return this.aiFeedbacksService.findBySessionId(sessionId, query);
  }

  @Get('session/:sessionId/stats')
  async getSessionStats(@Param('sessionId') sessionId: string) {
    return this.aiFeedbacksService.getAverageRating(sessionId);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  async getAllFeedbacks(@Query() query: QueryAiFeedbackDto) {
    return this.aiFeedbacksService.findAll(query);
  }

  @Get(':id')
  async getFeedback(@CurrentUser() user: UserPayload, @Param('id') feedbackId: string) {
    return this.aiFeedbacksService.findByIdAndUserId(feedbackId, user.id);
  }

  @Patch(':id')
  async updateFeedback(
    @CurrentUser() user: UserPayload,
    @Param('id') feedbackId: string,
    @Body() updateDto: UpdateAiFeedbackDto,
  ) {
    return this.aiFeedbacksService.update(feedbackId, user.id, updateDto);
  }

  @Patch(':id/helpful')
  async markHelpful(@Param('id') feedbackId: string) {
    return this.aiFeedbacksService.markHelpful(feedbackId);
  }

  @Patch(':id/verify')
  @Roles(UserRole.ADMIN)
  async verifyFeedback(@Param('id') feedbackId: string) {
    return this.aiFeedbacksService.verifyFeedback(feedbackId);
  }

  @Delete(':id')
  async deleteFeedback(@CurrentUser() user: UserPayload, @Param('id') feedbackId: string) {
    return this.aiFeedbacksService.delete(feedbackId, user.id);
  }
}
