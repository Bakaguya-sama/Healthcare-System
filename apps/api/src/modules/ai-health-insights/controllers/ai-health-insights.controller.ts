import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AiHealthInsightsService } from '../services/ai-health-insights.service';
import { CreateAiHealthInsightDto, UpdateAiHealthInsightDto, QueryAiHealthInsightDto } from '../dto/create-ai-health-insight.dto';
import { AiHealthInsight, InsightType, ConfidenceLevel } from '../entities/ai-health-insight.entity';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { Roles } from '../../../core/decorators/roles.decorator';
import type { UserPayload } from '../../../modules/auth/auth.payload';
import { UserRole } from '../../../modules/users/enums/user-role.enum';

@ApiTags('AI Health Insights')
@Controller('ai-health-insights')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AiHealthInsightsController {
  constructor(private readonly insightsService: AiHealthInsightsService) {}

  @Post()
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create new AI health insight' })
  @ApiResponse({ status: 201, description: 'Insight created', type: AiHealthInsight })
  async create(@Body() createDto: CreateAiHealthInsightDto, @CurrentUser() user: UserPayload): Promise<AiHealthInsight> {
    return this.insightsService.create(createDto);
  }

  @Get('my-insights')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user own insights' })
  @ApiResponse({ status: 200, description: 'Insights retrieved', type: [AiHealthInsight] })
  async getMyInsights(
    @CurrentUser() user: UserPayload,
    @Query() query: QueryAiHealthInsightDto,
  ): Promise<AiHealthInsight[]> {
    return this.insightsService.findByUserId(user.id, query);
  }

  @Get('pending-notifications')
  @Roles(UserRole.PATIENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get unnotified insights' })
  @ApiResponse({ status: 200, description: 'Pending notifications retrieved', type: [AiHealthInsight] })
  async getPendingNotifications(@CurrentUser() user: UserPayload): Promise<AiHealthInsight[]> {
    return this.insightsService.getPendingNotifications(user.id);
  }

  @Get('by-type/:type')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Search insights by type' })
  @ApiResponse({ status: 200, description: 'Insights found', type: [AiHealthInsight] })
  async searchByType(
    @Param('type') type: InsightType,
    @Query() query: QueryAiHealthInsightDto,
  ): Promise<AiHealthInsight[]> {
    return this.insightsService.searchByType(type, query);
  }

  @Get('by-confidence/:level')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Search insights by confidence level' })
  @ApiResponse({ status: 200, description: 'Insights found', type: [AiHealthInsight] })
  async searchByConfidence(
    @Param('level') level: ConfidenceLevel,
    @Query() query: QueryAiHealthInsightDto,
  ): Promise<AiHealthInsight[]> {
    return this.insightsService.searchByConfidence(level, query);
  }

  @Get('stats')
  @Roles(UserRole.PATIENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user insights statistics' })
  @ApiResponse({ status: 200, description: 'Stats retrieved' })
  async getStats(@CurrentUser() user: UserPayload): Promise<Record<string, any>> {
    return this.insightsService.getStatsByUser(user.id);
  }

  @Get()
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all insights' })
  @ApiResponse({ status: 200, description: 'All insights retrieved', type: [AiHealthInsight] })
  async findAll(@Query() query: QueryAiHealthInsightDto): Promise<AiHealthInsight[]> {
    return this.insightsService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get insight by ID' })
  @ApiResponse({ status: 200, description: 'Insight found', type: AiHealthInsight })
  async findById(@Param('id') id: string, @CurrentUser() user: UserPayload): Promise<AiHealthInsight> {
    return this.insightsService.findByIdAndUserId(id, user.id);
  }

  @Patch(':id')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update insight' })
  @ApiResponse({ status: 200, description: 'Insight updated', type: AiHealthInsight })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAiHealthInsightDto,
  ): Promise<AiHealthInsight> {
    return this.insightsService.update(id, updateDto);
  }

  @Patch(':id/acknowledge')
  @Roles(UserRole.PATIENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Acknowledge insight' })
  @ApiResponse({ status: 200, description: 'Insight acknowledged', type: AiHealthInsight })
  async acknowledgeInsight(@Param('id') id: string, @CurrentUser() user: UserPayload): Promise<AiHealthInsight> {
    return this.insightsService.acknowledgeInsight(id, user.id);
  }

  @Patch(':id/notify')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark insight as notified' })
  @ApiResponse({ status: 200, description: 'Insight marked as notified', type: AiHealthInsight })
  async markAsNotified(@Param('id') id: string): Promise<AiHealthInsight> {
    return this.insightsService.markAsNotified(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete insight' })
  @ApiResponse({ status: 204, description: 'Insight deleted' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.insightsService.delete(id);
  }
}
